import { httpFetch } from "./http";

const SYSTEM_ONE_URL = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";

const IS_CULTURAL_EVENT_QUESTION = {
  type: "noul",
  instructions:
    "A atração principal do evento anunciado nesta oferta é uma experiência cultural ou uma atividade de criação artística?",
  criteria: {
    true: "Inclui shows, música, sets de DJ, festas, teatro, dança, comédia, cinema, literatura, exposições, festivais culturais ou gastronômicos e oficinas criativas, como artesanato, pintura, cerâmica e arranjos florais.",
    false:
      "A atração principal é esporte, negócios, networking, venda de produtos, alimentação comum ou ensino de um assunto sem componente artístico ou cultural. Arte ou música apenas incidental não basta.",
  },
} as const;

/** Score above which a `noul` answer reads as "yes". */
const DEFAULT_THRESHOLD = 0.5;

interface SystemOneNoulAnswer {
  type: "noul";
  noul: number;
}

/**
 * A Noul has no separate `confidence` field: the score itself doubles as
 * the answer and the certainty. 0.5 is a coin flip; 0 and 1 are both
 * maximally confident, just in opposite directions.
 */
function confidenceFromNoul(noul: number): number {
  return Math.abs(noul - 0.5) * 2;
}

export interface CulturalEventClassification {
  isCulturalEvent: boolean;
  confidence: number;
}

export interface ClassificationCandidate {
  id: string;
  title: string;
  description?: string | null;
}

/** Persistence boundary used by the collector to run cultural-event classification. */
export interface CulturalEventClassificationStore {
  listCandidates(): Promise<ClassificationCandidate[]>;
  applyClassification(
    offerId: string,
    result: CulturalEventClassification,
  ): Promise<void>;
}

async function classifyState(
  apiKey: string,
  state: string,
  fetchPage: typeof httpFetch,
): Promise<SystemOneNoulAnswer> {
  const response = await fetchPage(SYSTEM_ONE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      state,
      questions: { is_cultural_event: IS_CULTURAL_EVENT_QUESTION },
    }),
  });
  if (!response.ok) {
    throw new Error(
      `typesafe.ai request failed with status ${response.status}`,
    );
  }
  const body = (await response.json()) as {
    answers: { is_cultural_event: SystemOneNoulAnswer };
  };
  return body.answers.is_cultural_event;
}

export interface ClassifyCulturalEventsOptions {
  repository: CulturalEventClassificationStore;
  apiKey: string;
  fetchPage?: typeof httpFetch;
  maxItems?: number;
  threshold?: number;
}

/**
 * Classifies candidates one at a time. A failed candidate is logged but
 * never allowed to stop the rest of the run.
 */
export async function classifyCulturalEvents({
  repository,
  apiKey,
  fetchPage = httpFetch,
  maxItems = Infinity,
  threshold = DEFAULT_THRESHOLD,
}: ClassifyCulturalEventsOptions): Promise<void> {
  const candidates = (await repository.listCandidates()).slice(0, maxItems);
  console.log(`[classify] ${candidates.length} offer(s) to classify this run`);

  let classified = 0;
  for (const candidate of candidates) {
    try {
      const state = [candidate.title, candidate.description]
        .filter((text) => text?.trim())
        .join("\n\n");
      const answer = await classifyState(apiKey, state, fetchPage);
      await repository.applyClassification(candidate.id, {
        isCulturalEvent: answer.noul >= threshold,
        confidence: confidenceFromNoul(answer.noul),
      });
      classified++;
    } catch (error) {
      console.error(`Could not classify offer ${candidate.id}:`, error);
    }
  }

  console.log(
    `[classify] done. ${classified}/${candidates.length} offer(s) classified.`,
  );
}
