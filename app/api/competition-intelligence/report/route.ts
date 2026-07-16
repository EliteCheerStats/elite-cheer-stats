import OpenAI from "openai";
import { NextResponse } from "next/server";

type ReportFacts = {
  teamName: string;
  division: string | null;
  fieldSize: number;
  fieldType: string;
  fieldCompression: string;
  competitivePosition: string;
  averageRank: number;
  ceilingRank: number;
  consistencyRank: number;
  topAverageSpread: number;
  teamsAboveAverage: number;
  teamsAboveCeiling: number;
  fieldHitZeroAverage: number;
  leaderAverageGap: number;
  leaderCeilingGap: number;

  fieldLeader: {
    name: string;
    average: number;
    ceiling: number;
    hitZero: number;
  } | null;

  highestUpsideTeam: {
    name: string;
    average: number;
    ceiling: number;
    scoringRange: number;
  } | null;

  consistencyLeader: {
    name: string;
    hitZero: number;
    events: number;
  } | null;

  eventContextComparisons: Array<{
    teamName: string;
    averageRank: number;
    averageGap: number;
    teamEvents: number;
    teamEventSizeStars: number;
    teamEventSizeLabel: string;
    myTeamEvents: number;
    myTeamEventSizeStars: number;
    myTeamEventSizeLabel: string;
    interpretation:
      | "opponent_profile_less_tested"
      | "opponent_profile_more_tested";
  }>;
};

type GeneratedReport = {
  fieldStoryHeadline: string;
  fieldStory: string;
  finalAssessmentHeadline: string;
  finalAssessment: string;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 503 }
      );
    }

    const openai = new OpenAI({
      apiKey,
    });

    const facts = (await request.json()) as ReportFacts;

    if (
      !facts.teamName ||
      !facts.fieldSize ||
      !facts.fieldType ||
      !facts.competitivePosition
    ) {
      return NextResponse.json(
        { error: "Required report facts are missing." },
        { status: 400 }
      );
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      instructions: `
You write Competition Intelligence reports for competitive cheer coaches.

The coach reads this report when the competition schedule is released and uses it to plan the preparation period before the event.

Use only the supplied facts.

ABSOLUTE RULES:
- Never expose JSON keys, variable names, or technical field names.
- Never write terms such as averageRank, ceilingRank, leaderAverageGap, fieldHitZeroAverage, scoringRange, or hitZero.
- Translate all internal values into natural coaching language.
- Round scores and score gaps to two decimal places.
- Round percentages to whole numbers.
- Respect the supplied fieldType, fieldCompression, and competitivePosition classifications exactly.
- Do not describe a field as compressed when fieldCompression is Low.
- Do not invent statistics, team traits, scores, placements, or outcomes.
- Do not predict an exact winning score or exact placement.
- Do not use generic advice such as "stay clean," "give it your all," or "anything can happen."
- Do not provide routine-construction, safety, lineup, or personnel advice.
- Do not repeat every supplied statistic.
- Do not state that standings are secure, settled, firmly established, or supported by high confidence when a required event-context comparison indicates that a leading team's profile comes from fewer events and meaningfully smaller average fields.
EVENT-SIZE CONTEXT:
- Event size is contextual evidence, not an achievement or reward.
- Never praise or penalize a team merely for attending larger or smaller competitions.
- If eventContextComparisons is empty, do not mention event size, field size, stars, testing level, or sample strength anywhere.
- If eventContextComparisons contains an entry where mustMention is true, the Field Story MUST include one clear standalone sentence about that comparison.
- That sentence must name both teams and plainly explain how the difference in event history changes the interpretation of the scoring gap.
- Do not bury the event-context sentence inside a longer sentence.
- Do not soften it with vague wording such as "adds some uncertainty," "may be less settled," or "provides additional context."
- Use direct language such as:
  - "That lead is based on one smaller-field appearance, while [focal team] has built its profile across multiple larger fields."
  - "The scoring gap is real, but the supporting event history is not equally strong."
  - "The current order should be treated with more caution than the averages alone suggest."
- Never say confidence in the standings is high when a required event-context comparison shows that the leader has fewer events and meaningfully smaller average fields.
- The score advantage remains real. Event context does not erase the gap; it changes how firmly established the gap appears.
- Use the supplied contextSummary as the factual basis, but rewrite it naturally.
- Prefer natural phrases such as "smaller average fields," "larger average fields," "one recorded event," or "multiple events."
- Do not expose star values unless they are essential to the explanation.
- Mention event context in the Final Assessment only when it materially changes the focal team's preparation outlook.
STYLE:
- Write for an experienced competitive cheer coach, not a data analyst.
- Use direct, professional, natural language.
- Avoid academic phrases such as "structurally privileges," "comparatively less upside," or "meaningful uncertainty."
- Explain what the data means for preparation.
- Use team names naturally.
- Mention limited sample size when a consistency leader has only one event.
- Keep each headline under 8 words.
- Keep each paragraph between 45 and 70 words.
- Use no more than 3 sentences per paragraph.
- Avoid repeating the same fact in both sections.
- Each paragraph must include at least one concrete comparison involving the focal team and a named opponent or field leader.

FIELD STORY:
Explain what defines this selected field:
- whether the leaders are compressed or separated
- whether ceiling pressure creates movement potential
- which profiles make the expected order less certain
- what is unusual or important about the field
- When supplied, incorporate the most meaningful event-context comparison naturally, but only when it changes how the scoring order should be interpreted.
- When mustMention is true, devote one full sentence to event context.
- Place that sentence immediately after describing the scoring gap between the focal team and the opponent.
- The paragraph must clearly distinguish between the size of the scoring gap and the strength of the evidence supporting that gap.
FINAL ASSESSMENT:
Explain:
- the team's current relative position
- the most meaningful preparation opportunity
- how average, ceiling, and consistency combine
- why the primary competitors matter
- Use event context only if it materially changes the confidence placed in the focal team's relative position.

Return valid JSON only with this exact shape:
{
  "fieldStoryHeadline": "string",
  "fieldStory": "string",
  "finalAssessmentHeadline": "string",
  "finalAssessment": "string"
}

Headline requirements:
- Under 10 words
- Natural coaching language
- No raw statistics

Paragraph requirements:
- Between 65 and 105 words
- No bullet points
- No internal variable names
`.trim(),
      input: JSON.stringify(facts),
    });

    const rawText = response.output_text.trim();

    const cleanedText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");

    const report = JSON.parse(cleanedText) as GeneratedReport;

    if (
      !report.fieldStoryHeadline ||
      !report.fieldStory ||
      !report.finalAssessmentHeadline ||
      !report.finalAssessment
    ) {
      throw new Error("The AI response did not include all required fields.");
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Competition report generation failed:", error);

    return NextResponse.json(
      {
        error: "Unable to generate the Competition Intelligence report.",
      },
      { status: 500 }
    );
  }
}