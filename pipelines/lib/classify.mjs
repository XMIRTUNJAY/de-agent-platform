/**
 * CLASSIFY — map a discovered item to exactly one canonical category and a
 * resource type. Two backends:
 *
 *  - rules  (default): deterministic keyword scoring against the taxonomy.
 *    Testable offline. Falls back to type `reference` when unsure.
 *  - agent  (future, opt-in): an LLM call for the pattern/tutorial judgment.
 *    Drafts from it are still human-reviewed, but the pipeline itself never
 *    requires network+key to run.
 *
 * Confidence: rules return score margin between best and second-best match;
 * below MIN_CONFIDENCE the item becomes a Reference with category null
 * (human assigns it during review).
 */

// Signals: keyword → category id. Kept compact; extend over time.
const CATEGORY_SIGNALS = {
  'cat-sql': ['sql', 'query plan', 'explain plan'],
  'cat-python': ['python', 'pandas', 'typing'],
  'cat-data-formats': ['parquet', 'avro', 'orc', 'file format', 'json schema'],
  'cat-databases': ['postgres', 'mysql', 'olap', 'duckdb', 'database internals'],
  'cat-warehouses': ['snowflake', 'redshift', 'bigquery', 'data warehouse', 'clustering'],
  'cat-dbt': ['dbt', 'analytics engineering', 'semantic layer'],
  'cat-lakes': ['data lake', 's3', 'object storage'],
  'cat-lakehouse': ['iceberg', 'delta lake', 'hudi', 'lakehouse', 'table format'],
  'cat-airflow': ['airflow', 'dagster', 'prefect', 'orchestration', 'backfill'],
  'cat-spark': ['spark', 'pyspark', 'shuffle', 'skew'],
  'cat-batch-processing': ['batch processing', 'etl batch'],
  'cat-kafka': ['kafka', 'consumer group', 'consumer lag'],
  'cat-streaming': ['flink', 'streaming', 'window', 'watermark', 'exactly-once'],
  'cat-cdc': ['cdc', 'change data capture', 'debezium'],
  'cat-ingestion': ['fivetran', 'airbyte', 'ingestion'],
  'cat-file-ingestion': ['file ingestion', 'csv upload', 'landing zone'],
  'cat-aws': ['aws', 's3', 'glue', 'athena', 'redshift', 'lambda'],
  'cat-gcp': ['gcp', 'google cloud', 'bigquery', 'dataflow'],
  'cat-azure': ['azure', 'synapse', 'fabric'],
  'cat-databricks': ['databricks', 'unity catalog'],
  'cat-snowflake': ['snowflake'],
  'cat-data-contracts': ['data contract', 'schema evolution', 'schema registry'],
  'cat-data-quality': ['data quality', 'great expectations', 'soda', 'null rate'],
  'cat-testing': ['data tests', 'unit test', 'pytest', 'ci for data'],
  'cat-data-observability': ['observability', 'data downtime', 'freshness monitor'],
  'cat-data-lineage': ['lineage', 'openlineage', 'marquez'],
  'cat-data-catalog': ['data catalog', 'datahub', 'openmetadata', 'amundsen'],
  'cat-governance': ['governance', 'pii', 'gdpr', 'masking', 'access control'],
  'cat-cost-engineering': ['cost', 'finops', 'scanned bytes', 'warehouse spend'],
  'cat-cicd': ['ci/cd', 'slim ci', 'data ops'],
  'cat-production-operations': ['on-call', 'incident', 'runbook', 'slo', 'postmortem'],
  'cat-reliability': ['reliability', 'idempotent', 'late data', 'retry'],
  'cat-agentic': [
    'agent', 'mcp', 'model context protocol', 'llm', 'ai agent', 'claude', 'coding agent',
    'openai', 'anthropic', 'gemini', 'deepseek', 'qwen', 'moonshot', 'kimi', 'glm',
    'mistral', 'llama', 'langchain', 'llamaindex', 'crewai', 'rag', 'retrieval',
    'embedding', 'vector', 'prompt', 'chatgpt', 'copilot', 'agentic', 'agents',
    'function calling', 'large language model', 'multimodal', 'fine-tuning',
  ],
  'cat-engineering-foundations': ['data structures', 'fundamentals', 'cs basics', 'learn to code', 'coding basics'],
  'cat-system-design': ['system design', 'architecture decision', 'adhoc scale'],
  'cat-infrastructure': ['kubernetes', 'terraform', 'infrastructure', 'docker', 'devops', 'helm'],
  'cat-security': ['secret', 'credential', 'vault', 'encryption', 'iam'],
};

// Type nudges: only promote beyond reference on strong structural signals.
// Drafts stay `type: reference`; the matched intent is exposed as
// `suggested_type` so a human reviewer can promote deliberately.
const TYPE_SIGNALS = {
  tutorial: [
    'tutorial', 'course', 'step-by-step', 'step by step', 'getting started',
    'get started', 'beginner', 'beginners', 'how to', 'walkthrough', 'hands-on',
    'from scratch', 'end-to-end', 'end to end', 'project', 'learn ', 'bootcamp',
  ],
  architecture: ['how we built', 'architecture', 'design pattern', 'lessons learned', 'postmortem'],
  runbook: ['incident', 'outage', 'degradation', 'recovery'],
};

const MIN_CONFIDENCE = 2; // margin of best over second-best category score

export function classifyRules(item, taxonomy) {
  const haystack = `${item.title ?? ''} ${item.summary ?? ''}`.toLowerCase();
  const scores = {};
  for (const [cat, words] of Object.entries(CATEGORY_SIGNALS)) {
    let s = 0;
    for (const w of words) {
      // word-ish boundary match; multi-word phrases score higher
      if (haystack.includes(w)) s += w.includes(' ') ? 3 : 2;
    }
    if (s) scores[cat] = s;
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const best = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const margin = best && second ? best[1] - second[1] : best ? best[1] : 0;
  const confident = !!best && margin >= MIN_CONFIDENCE;

  let type = 'reference';
  let suggested_type = null;
  for (const [t, words] of Object.entries(TYPE_SIGNALS)) {
    if (words.some((w) => haystack.includes(w))) {
      suggested_type = t;
      // network sources default to reference/architecture drafts; skills/runbooks
      // remain human-authored. (tutorial/runbook classification seeds are kept
      // as references with a suggested_type hint for the reviewer.)
      type = t === 'architecture' ? 'architecture' : 'reference';
      break;
    }
  }

  return {
    category: confident ? best[0] : null,
    suggested_categories: ranked.slice(0, 3).map(([c]) => c),
    type,
    suggested_type,
    confidence: confident ? (margin >= 5 ? 'high' : 'medium') : 'low',
    scores,
  };
}

/** Resolve a classification against the real taxonomy; drop unknown ids. */
export function resolveClassification(cls, taxonomy) {
  const known = new Set((taxonomy.categories ?? []).map((c) => c.id));
  const suggested = (cls.suggested_categories ?? []).filter((c) => known.has(c));
  const category = cls.category && known.has(cls.category) ? cls.category : (suggested[0] ?? null);
  return { ...cls, category, suggested_categories: suggested };
}
