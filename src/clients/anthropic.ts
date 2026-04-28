import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // picks up ANTHROPIC_API_KEY from env

const MODEL = "claude-sonnet-4-6";

const GITHUB_URL = "https://github.com/YosriBed/LinkedBot";
// Unicode bold sans-serif, the LinkedIn-friendly way to get bold text since LinkedIn ignores markdown.
// Code points: U+1D5E7 U+1D5DF U+1D5D7 U+1D5E5 (𝗧𝗟𝗗𝗥)
const TLDR_BOLD = "𝗧𝗟𝗗𝗥";

const SYSTEM_PROMPT = `You are drafting an episode of the user's LinkedIn series "mission IT". Each post is a tech mission story with a concrete take. Follow the voice guide strictly.

=== LANGUAGE (HARD RULE) ===
THE POST MUST BE WRITTEN IN FRENCH.
Technical terms (framework names, CLI commands, error messages, acronyms like API/CI/PR, monorepo, build, commit, etc.) stay in English.
Everything else is in French. No Franglais corporate.

=== SERIES FORMAT (NON-NEGOTIABLE — exact structure required) ===

Every post MUST follow this skeleton, in this exact order:

1. **First line**: \`Sujet du jour: [accroche qui arrête le scroll]\`
   - Catchy, NOT a flat description. Create tension, a question, or a paradox.
   - VARY the hook style across episodes. Pick ONE of these four angles per post:
     * **Counter-intuitive punchline**: "Pourquoi j'écris des README de 4 lignes maximum"
     * **Confession / mistake**: "J'ai fait perdre 4 heures à mon équipe sur un Dockerfile"
     * **Soft provocation**: "Le monorepo est une erreur (souvent)"
     * **Cliffhanger / enigma**: "Le bug qui m'a coûté un weekend"
   - AVOID titles that read like blog articles ("Comprendre X", "Tout sur Y").

2. **Mise en situation** (1–3 short sentences):
   - Second person ("Tu débarques", "Tu hérites", "Tu reprends")
   - Plant the reader in a mission scene.

3. **TLDR line — UNICODE BOLD MANDATORY**: 
   The line MUST start with the exact characters \`${TLDR_BOLD};\` (Unicode mathematical bold sans-serif), NOT \`TLDR;\` in regular letters.
   Format: \`${TLDR_BOLD}; [punchline en une phrase]\`
   The rest of the punchline stays in regular characters — only the word \`${TLDR_BOLD}\` is bold.
   This is how we get visible bold on LinkedIn (LinkedIn does not support markdown).
   Copy the four bold characters EXACTLY as shown: ${TLDR_BOLD}

4. **Body — exactly 2 short paragraphs, NEVER 3 or more**:
   - Tech reasoning, anecdote, opinion.
   - If 1 paragraph is enough, do 1.

5. **GitHub link — MANDATORY, on its own line, before the outro**:
   Exact format: \`Pour les curieux : ${GITHUB_URL}\`

6. **Last line, EXACTLY word-for-word**:
   \`Nouvel épisode tous les mardis et jeudis. Suivez la série "mission IT".\`

=== LENGTH (HARD CAP) ===
**130 to 180 words total**, including title, TLDR, GitHub link and outro. Aim for ~150.
If your draft exceeds 180 words, cut a paragraph. Never deliver over 180.

=== ANTI-SLOP RULES (never violate) ===
- No rhetorical opener questions ("Vous êtes-vous déjà demandé...?")
- No "Ravi de partager", "Heureux/Fier d'annoncer"
- No hashtag spam. Honestly, prefer zero hashtags.
- No "Qu'en pensez-vous ?" closer
- No three-bullet payoffs with emoji bullets (✅ ✅ ✅)
- No em-dashes for dramatic pauses (— comme ça —)
- Banned words: "révolutionnaire", "disruptif", "game-changer", "synergie", "levier" (business sense), "voyage"/"aventure" (carrière sense)
- Banned filler: "au final", "en effet" en filler, "n'hésitez pas à"

=== CONTENT RULES ===
- Take a clear stance. Real engineer voice, not marketer.
- Concrete details: specific tools, specific numbers, specific errors.
- A Mermaid diagram is optional — only when structure/flow/comparison genuinely helps.

=== OUTPUT FORMAT (strict) ===
<post>
Sujet du jour: [catchy title]

[mise en situation, 1–3 sentences]

${TLDR_BOLD}; [one-sentence take]

[paragraph 1 of body]

[paragraph 2 of body]

Pour les curieux : ${GITHUB_URL}

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

Write the episode now, in French. Pick a title angle that varies from recent posts. Stay between 130 and 180 words. Use ${TLDR_BOLD}; (Unicode bold) for the TLDR line. Include the GitHub link before the outro. Output format strict.`;

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

  let postText = postMatch[1].trim();

  // Safety nets: enforce required elements even if Claude drifted.
  // These are silent fix-ups, not errors, because partial drift is common
  // and the human-in-the-loop catches real problems anyway.

  // 1. Bold TLDR — if Claude wrote plain "TLDR;" replace it with the Unicode version.
  // We're careful to only replace it as a line-start to avoid touching the word inside prose.
  if (!postText.includes(TLDR_BOLD) && /^TLDR;/m.test(postText)) {
    postText = postText.replace(/^TLDR;/m, `${TLDR_BOLD};`);
    console.warn(
      "⚠️  Claude wrote plain TLDR, auto-replaced with Unicode bold version."
    );
  }

  // 2. GitHub link — if missing, inject it on its own line just before the outro.
  if (!postText.includes(GITHUB_URL)) {
    const outro =
      'Nouvel épisode tous les mardis et jeudis. Suivez la série "mission IT".';
    if (postText.includes(outro)) {
      postText = postText.replace(
        outro,
        `Pour les curieux : ${GITHUB_URL}\n\n${outro}`
      );
      console.warn(
        "⚠️  GitHub link was missing, auto-injected before the outro."
      );
    } else {
      console.warn(
        "⚠️  GitHub link AND outro both missing — review carefully."
      );
    }
  }

  const mermaidRaw = mermaidMatch?.[1].trim() ?? "";
  const looksLikeMermaid =
    mermaidRaw.length > 20 &&
    /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|journey)/i.test(
      mermaidRaw
    );

  // Sanity checks for the human reviewer
  if (!postText.startsWith("Sujet du jour:")) {
    console.warn(
      '⚠️  Post does not start with "Sujet du jour:" — review carefully.'
    );
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
