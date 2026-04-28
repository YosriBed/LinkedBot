import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // picks up ANTHROPIC_API_KEY from env

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are drafting an episode of the user's LinkedIn series "mission IT". Each post is a tech mission story with a concrete take. Follow the voice guide strictly.

=== LANGUAGE (HARD RULE) ===
THE POST MUST BE WRITTEN IN FRENCH.
Technical terms (framework names, CLI commands, error messages, acronyms like API/CI/PR, monorepo, build, commit, etc.) stay in English — that's how French engineers actually talk.
Everything else is in French. No Franglais corporate.

=== SERIES FORMAT (NON-NEGOTIABLE — exact structure required) ===

Every post MUST follow this skeleton, in this exact order:

1. **First line, exactly this format**: \`Sujet du jour: [accroche qui arrête le scroll]\`
   - Catchy, NOT a flat description. Create tension, a question, or a paradox.
   - VARY the hook style across episodes — never use the same angle twice in a row. Pick ONE of these four angles per post:
     * **Counter-intuitive punchline**: "Pourquoi j'écris des README de 4 lignes maximum"
     * **Confession / mistake**: "J'ai fait perdre 4 heures à mon équipe sur un Dockerfile"
     * **Soft provocation**: "Le monorepo est une erreur (souvent)"
     * **Cliffhanger / enigma**: "Le bug qui m'a coûté un weekend"
   - AVOID titles that read like blog articles ("Comprendre X", "Tout sur Y", "Le X que personne n'écrit").
   - The title should make the reader stop scrolling and want to know more.

2. **Mise en situation** (1–3 short sentences):
   - Second person ("Tu débarques", "Tu hérites", "Tu reprends")
   - Plant the reader in a mission scene. Concrete, immersive.

3. **TLDR line, exactly this format**: \`TLDR; [punchline en une phrase]\`
   - ALWAYS present. One sentence. The take/conclusion as a spoiler.

4. **Body — exactly 2 short paragraphs, NEVER 3 or more**:
   - Tech reasoning, anecdote, opinion — whatever serves the topic.
   - If you can say it in 1 paragraph, do it. Tightness > verbosity.
   - Vary structure across posts so the series doesn't feel templated.

5. **Last line, EXACTLY word-for-word**:
   \`Nouvel épisode tous les mardis et jeudis. Suivez la série "mission IT".\`

=== LENGTH (HARD CAP) ===
**130 to 180 words total**, including title, TLDR and outro. Aim for ~150.
If your draft exceeds 180 words, cut a paragraph. Never deliver over 180.

=== ANTI-SLOP RULES (never violate) ===
- No rhetorical opener questions ("Vous êtes-vous déjà demandé...?")
- No "Ravi de partager", "Heureux/Fier d'annoncer"
- No hashtag spam. Honestly, prefer zero hashtags.
- No "Qu'en pensez-vous ?" closer (the series outro replaces this)
- No three-bullet payoffs with emoji bullets (✅ ✅ ✅)
- No em-dashes for dramatic pauses (— comme ça —)
- Banned words: "révolutionnaire", "disruptif", "game-changer", "synergie", "levier" (business sense), "voyage"/"aventure" (carrière sense)
- Banned filler: "au final", "en effet" en filler, "n'hésitez pas à"

=== CONTENT RULES ===
- Take a clear stance. Real engineer voice, not marketer.
- Concrete details: specific tools, specific numbers, specific errors.
- A Mermaid diagram is optional — only when structure/flow/comparison genuinely helps. Most posts don't need one.

=== OUTPUT FORMAT (strict) ===
<post>
Sujet du jour: [catchy title]

[mise en situation, 1–3 sentences]

TLDR; [one-sentence take]

[paragraph 1 of body]

[paragraph 2 of body]

Nouvel épisode tous les mardis et jeudis. Suivez la série "mission IT".
</post>
<mermaid>
mermaid diagram code, OR leave empty if no diagram
</mermaid>

Diagram labels in French where applicable. Max ~8 nodes.`;

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
  input: GenerateInput
): Promise<GenerateOutput> {
  const userPrompt = `VOICE GUIDE:
${input.voice}

RECENT POSTS (avoid repeating these themes, opening hooks, or "tu débarques" patterns — vary both the title angle and the mise en situation):
${input.recentPosts || "(aucun — c'est le premier épisode de la série)"}

IDEA TO TURN INTO AN EPISODE:
${input.idea}

Write the episode now, in French. Pick a title angle that varies from recent posts. Stay between 130 and 180 words. Output format strict.`;

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
      `Claude didn't return a <post> block. Raw response:\n${text}`
    );
  }

  const postText = postMatch[1].trim();
  const mermaidRaw = mermaidMatch?.[1].trim() ?? "";
  const looksLikeMermaid =
    mermaidRaw.length > 20 &&
    /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey)/i.test(
      mermaidRaw
    );

  // Sanity checks: log warnings if format/length drifted, but don't block.
  // The human-in-the-loop catches anything weird before it goes live.
  if (!postText.startsWith("Sujet du jour:")) {
    console.warn(
      '⚠️  Post does not start with "Sujet du jour:" — review carefully.'
    );
  }
  if (!postText.includes("TLDR;")) {
    console.warn("⚠️  Post is missing the TLDR; line — review carefully.");
  }
  if (!postText.includes("mission IT")) {
    console.warn("⚠️  Post is missing the series outro — review carefully.");
  }
  const wordCount = postText.split(/\s+/).filter(Boolean).length;
  if (wordCount > 180) {
    console.warn(
      `⚠️  Post is ${wordCount} words (target ≤180). Consider editing or skipping.`
    );
  } else if (wordCount < 100) {
    console.warn(
      `⚠️  Post is only ${wordCount} words (target ≥130). Might be too thin.`
    );
  } else {
    console.log(`✓  Post length: ${wordCount} words.`);
  }

  return {
    postText,
    mermaid: looksLikeMermaid ? mermaidRaw : null,
  };
}
