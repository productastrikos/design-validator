// ─────────────────────────────────────────────────────────────────────────────
// Static reference lists for the Rules & Regulations Assistant: the design domains
// offered in its filter, and the quick-reference prompts in its side panel. Answers
// themselves always come from the server's knowledge base.
// ─────────────────────────────────────────────────────────────────────────────

export const DOMAINS = ['Hull', 'Electrical', 'Mechanical', 'HVAC', 'Piping', 'Outfit'];

export const RULE_CORPUS = [
  { id: 'SOLAS II-1/12',  title: 'Peak and machinery space bulkheads',              domain: 'Hull' },
  { id: 'SOLAS II-1/43',  title: 'Emergency source of electrical power in cargo ships', domain: 'Electrical' },
  { id: 'SOLAS II-2/10',  title: 'Fire fighting',                                   domain: 'Outfit' },
  { id: 'SOLAS III/31',   title: 'Survival craft and rescue boats on cargo ships',  domain: 'Outfit' },
  { id: 'LSA Code IV/4.1', title: 'General requirements for liferafts',             domain: 'Outfit' },
];
