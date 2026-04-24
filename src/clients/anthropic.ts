import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // picks up ANTHROPIC_API_KEY from env

// Swap if you prefer Opus for quality or Haiku for cost. Sonnet is the sweet spot.
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are drafting a LinkedIn post in the user's voice. Follow their voice guide strictly.

HARD RULES — never violate:
- No rhetorical opener questions ("Ever wondered...?", "What if I told you...")
- No "🚀 Excited to share", "Thrilled to announce", or any variant
- No hashtag spam. Max 2 hashtags, only if genuinely relevant.
- No "Thoughts?" or "What do you think?" closer
- No three-bullet payoffs with emoji bullets
- No em-dashes used for dramatic pauses (— like this —)
- No "game-changer", "revolutionary", "leverage", "synergy", "journey"
- 80 to 180 words. Short paragraphs. Blank lines between thoughts.

CONTENT RULES:
- Take a clear stance or share a specific observation. Something concrete.
- Sound like a real engineer talking to other engineers, not a marketer.
- Tech-curious recruiters should still follow the gist.
- A diagram is ONLY worth including when it shows structure/flow/comparison that prose can't convey cleanly. If in doubt, skip it.

OUTPUT FORMAT (strict, no deviation):
<post>
the post text goes here
</post>
<mermaid>
mermaid diagram code here, OR leave this section empty if no diagram
</mermaid>

If including a diagram, keep it simple (max ~8 nodes). Valid Mermaid syntax only.`;

export interface GenerateInput {
  voice: string;
  idea: string;
  recentPosts: string;
}

export interface GenerateOutput {
  postText: string;
  mermaid: string | null;
}

export async function generatePost(
  input: GenerateInput,
): Promise<GenerateOutput> {
  const userPrompt = `VOICE GUIDE:
${input.voice}

RECENT POSTS (avoid repeating these themes or phrasing patterns):
${input.recentPosts || "(none yet — this is the first post)"}

IDEA TO TURN INTO A POST:
${input.idea}

Write the post now. Follow the output format exactly.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const postMatch = text.match(/<post>([\s\S]*?)<\/post>/);
  const mermaidMatch = text.match(/<mermaid>([\s\S]*?)<\/mermaid>/);

  if (!postMatch) {
    throw new Error(
      `Claude didn't return a <post> block. Raw response:\n${text}`,
    );
  }

  const postText = postMatch[1].trim();
  const mermaidRaw = mermaidMatch?.[1].trim() ?? "";
  // Heuristic: real Mermaid code is usually > 20 chars and starts with a diagram keyword
  const looksLikeMermaid =
    mermaidRaw.length > 20 &&
    /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey)/i.test(
      mermaidRaw,
    );

  return {
    postText,
    mermaid: looksLikeMermaid ? mermaidRaw : null,
  };
}
