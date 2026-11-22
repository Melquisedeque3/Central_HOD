# Gadline — Transcrição Completa

---

## Seção 3 — Verificação de controle de qualidade de áudio

Antes de segmentar uma gravação, execute esta verificação de controle de qualidade de áudio. Se algum motivo de rejeição se aplicar, selecione Rejeitar e enviar; não continue com a segmentação ou transcrição, e nenhum trabalho adicional será feito no arquivo. Problemas localizados — uma palavra pouco clara, um pequeno patch barulhento — não são rejeitados; eles são tratados em segmentação ou transcrição.

**As verificações da Tabela 1 aplicam-se a todas as gravações, ambos os tipos de dados. As verificações da Tabela 2 aplicam-se apenas a gravações de troca de código — a telefonia não tem exigência de troca de código, portanto nenhuma das Tabelas 2 é um motivo de rejeição para um arquivo de telefonia. Verifique o tipo de dados do seu arquivo antes de começar.**

---

### Tabela 1 — Verificações de base: todas as gravações (troca de código e telefonia)

| Categoria | Rejeitar razão |
|---|---|
| Local | A fala não está no local atribuído a esta tarefa — por exemplo, uma tarefa ar-MSA realmente falada em ar-AE, ou fala es-ES em uma tarefa es-US. O local da tarefa está no nome do projeto; forneça um comentário antes do envio. |
| Qualidade de áudio | Fala difícil de entender em mais do que pontos isolados (ruído, distorção, queda); falha estrutural (mono/misto ou um canal que não isola seu falante); um falante muito baixo para acompanhar grande parte da conversa; eco persistente, reverberação ou corte que confunde a fala; uma voz de terceiros misturada e não separável |
| Naturalidade | Ler, recitar ou fazer uma apresentação ensaiada/roteirizada; áudio gerado por IA/sintético/TTS; sotaque assumido ou imitado (não a variedade declarada) |
| Qualidade da conversa | Monólogo (um orador domina, outro mal fala); participação desigual (um orador abaixo do mínimo); conversa incompleta (sem abertura/fechamento claro, final abrupto); longo silêncio (mais de 6 segundos); não é uma troca interativa genuína (rodízio/voltas de leitura) |
| Duração | *(Nenhum motivo de rejeição especificado atualmente para linha de base/telefonia — veja o sinalizador abaixo)* |
| Conteúdo e conformidade | Identificadores pessoais reais (PII) — nomes reais, endereços, números de telefone, endereços de e-mail, números de identificação/conta ou detalhes financeiros ou médicos, pertencentes a um orador ou a outra pessoa mencionada; conteúdo político, religioso, violento ou ofensivo; conteúdo de atividade ilegal; conteúdo duplicado/reutilizado |
| Orador e consentimento | Língua primária não é de nível nativo; mais de 2 falantes; o falante excedeu o limite de 2 horas |

---

### Tabela 2 — Verificações adicionais: apenas gravações de troca de código

| Categoria | Rejeitar razão |
|---|---|
| Troca de código | Nenhuma ou pouca troca — abaixo do piso de 8% para uma conversa individual, ou um lote que não esteja dentro da faixa solicitada de 10–15%; apenas palavras emprestadas/nomes comerciais isolados, nenhuma frase; apenas intersentencial (nenhuma troca dentro da frase); alta frequência de troca forçada/com script/on-cue; inglês quebrado, parado ou com sotaque afetado; inglês abaixo da proficiência declarada; terceira língua usada mais do que incidentalmente |
| Duração | Menos de 3 minutos; mais de 30 minutos |

---

## Seção 4 — Segmentos e carimbos de data/hora

A segmentação é a primeira passagem funcional em um arquivo que passou na verificação de controle de qualidade de áudio. Ele divide o áudio em unidades com registro de data e hora chamadas segmentos, antes de qualquer transcrição começar.

### Dois tipos de segmento:

| Tipo | Use-o para | Transcrito? |
|---|---|---|
| Discurso | A fala de um falante formando uma unidade natural — uma volta, uma frase ou uma frase. Também sons vocais (risos, tosse) de um falante conhecido. | Sim |
| Não discurso | Regiões audíveis que deliberadamente não são transcritas: vozes sobrepostas que não podem ser separadas, longos trechos de música ou ruído. Mostra que a região foi ouvida e deliberadamente ignorada, não perdida. | Não |

---

### Regras de segmentação

#### ✅ Do's

- Keep every Speech segment **20 seconds or shorter** (the length limit of common training pipelines) — and as long as possible within that limit, so context is preserved.
- Place boundaries tight to the speech: no more than **0.3 seconds** of non-speech padding at either end.
- Break long turns at natural points, in this order of preference: end of turn, then end of sentence, then between phrases, then at a pause.
- Write timestamps in seconds with three decimals (example: 12.480).
- Quiet gaps between turns simply stay unsegmented — gapless coverage is not required.

#### ❌ Don'ts

- Never cut through the middle of a word.
- Never put two speakers in one Speech segment.
- Never break a sentence into pieces when it fits inside 20 seconds.
- Never leave audible speech uncovered — if it won't be transcribed, cover it with NonSpeech.

---

### O que cada segmento do Discurso carrega:

| Campo | Regra | Exemplo |
|---|---|---|
| início / fim | Segundos, três decimais | 128.400 / 135.210 |
| orador | Um ID consistente por pessoa, idêntico em todo o arquivo e em todos os arquivos em que aparecem | S2 |
| línguas | Cada idioma falado no segmento, como códigos ISO, é o idioma principal primeiro. Deve sempre corresponder às tags de idioma no texto: um segmento sem tag `<cs:>` lista apenas o idioma principal. | ["de", "en"] |
| texto | A transcrição literal, conforme as Seções 5 a 19 | — |

> **Nota importante**: Um silêncio de 2 segundos ou mais dentro de um segmento é marcado com uma [pausa]. Quando um silêncio se estende por cerca de 3 segundos, prefira terminar o segmento e começar um novo depois dele.

---

## Section 5 — Speakers

Every segment needs a speaker attached to it. Here's how speaker identity works across a file, and across the whole dataset.

- Every Speech segment belongs to exactly one speaker — two voices never share a segment.
- Each person keeps one stable ID (S1, S2...) through the whole file, and across every file they appear in anywhere in the dataset.
- Speaker demographics (gender, age group, region, native language, English level, role) are recorded once per speaker in the file metadata.
- Who is speaking is a Speech-segment property; what to do when speakers collide is covered in Section 18 (overlap) and Section 19 (background speech).

---

## Section 6 — Verbatim Transcription

The transcript must match the audio exactly so the recorded speech is represented accurately. Every other rule in this specification builds on this principle.

#### ✅ Do's

- Write every audible word of the target speaker, in the order spoken.
- Keep non-standard grammar, slang, and regional constructions exactly as produced.
- Keep factual errors — transcribe what was said, not what is true.
- Keep profanity exactly as spoken; never mask or soften it.
- Keep audible asides and self-talk from the target speaker.

#### ❌ Don'ts

- Never correct, reorder, complete, or summarize.
- Never add words the speaker did not say — not even obviously missing ones.
- Never drop words because they seem redundant or embarrassing.

| You hear | Correct | Incorrect |
|---|---|---|
| "him and me was there" | Him and me was there. | He and I were there. |
| "the capital of Australia, Sydney" | The capital of Australia, Sydney. | The capital of Australia, Canberra. (corrected fact) |
| "I ain't gonna lie" | I ain't gonna lie. | I am not going to lie. |
| swearing | Transcribed exactly as spoken | Masked or softened |
| mutters "where did I put it" mid-task | Where did I put it? | Omitted as irrelevant |

---

## Section 7 — Repetitions and False Starts

Spontaneous speech circles back, restarts, and repairs itself constantly. Every audible attempt is kept, in order. These six situations sound similar, but only one of them — a broken-off word — takes markup.

| Situation | You hear | Write |
|---|---|---|
| Stuttered word | "I I I know" | I I I know. — each repetition written |
| Repeated phrase | "we could we could try" | We could we could try. |
| False start, all words complete | "we take the bus no the train" | We take the bus no the train. |
| Restart with a broken word | "on Mon- on Tuesday" | On `<cut>Mon</cut>` on Tuesday. (Section 17) |
| Repetition for emphasis | "it was very very good" | It was very very good. (ordinary words) |
| Whole sentence abandoned | "Did you— why is the door open?" | Did you why is the door open? (both attempts, no dash) |

> **Important Note**: Do not tidy. Dropping "obvious" repeats is the most common verbatim mistake. If the audio has three attempts, the text has three attempts.

---

## Section 8 — Spelling

One word, one spelling. The reference dictionary of your language (named in your profile, Section 23) is the sole authority — not personal preference, autocorrect, or unofficial sources.

- Use standard dictionary orthography — **never phonetic spelling**. The transcript records which word was said, not how it sounded.
- **Mispronounced words** are written in their intended standard form when the intent is clear. If the intent is not recoverable, use an `<unclear>` tag instead of inventing a spelling.
- **Dialect pronunciation is standardized; dialect vocabulary is kept**. "dis ting" is the words "this thing" pronounced regionally, so it is written in standard spelling. "Y'all" is a real lexical item, so it is written as said.
- **Established informal forms** (listed in the dictionary: gonna, wanna, j'suis, gibt's) are words in their own right — keep them when spoken.
- **Coined or invented words** get the most plausible spelling, kept consistent within the file.
- Run a spell-check before submitting every file.

| You hear | Correct | Incorrect |
|---|---|---|
| "probly gonna rain" | Probably gonna rain. | Probly going to rain. (phonetic and over-corrected) |
| "dis ting broke" | This thing broke. | Dis ting broke. |
| "y'all ready?" | Y'all ready? | You all ready? |
| speaker coins "chatify" | We should chatify the workflow. | We should `<unclear>chatify</unclear>` (it is clear, just new) |
| "anonimity" (mispronounced) | Anonymity. | Anonimity. |

---

## Section 9 — Capitalization

Capitals follow the standard orthography of your language — nothing more, nothing less. They carry grammatical information, not emphasis.

- Capitalize sentence-initial words (where your language does), proper names, and whatever your language capitalizes by rule — see your profile (Section 23): German capitalizes all nouns; French and Spanish keep weekdays and months lowercase; Vietnamese capitalizes weekdays.
- Brands keep their official casing, including mid-word capitals: eBay, iPhone, YouTube.
- Letters read out one by one are uppercase (Section 11): plan B, I D.
- **Never use capitals for emphasis or volume**. Shouted speech is written like any other speech.

| You hear | Correct | Incorrect |
|---|---|---|
| "we met anna in berlin" | We met Anna in Berlin. | we met anna in berlin. |
| someone shouts "get out" | Get out! | GET OUT!!! |
| "check youtube on your iphone" | Check YouTube on your iPhone. | Check Youtube on your Iphone. |
| "plan b it is" | Plan B it is. | Plan b it is. |
| new sentence after a question | Really? I had no idea. | Really? i had no idea. |

---

## Section 10 — Numbers

Every number is written out in words, exactly in the form the speaker chose. No digits anywhere in the transcript — and no converting between spoken forms: "three oh six" and "three hundred six" are different utterances of the same value, and the text must preserve which one was said.

| Case | You hear | Write |
|---|---|---|
| Cardinal | "three hundred six" | three hundred six |
| Digit string | "three oh six" | three oh six |
| Year | "twenty twenty-six" | twenty twenty-six |
| Decimal | "three point five" | three point five |
| Fraction | "two thirds" | two thirds |
| Time | "nine thirty" / "half past nine" | nine thirty / half past nine — as chosen |
| Money | "twenty euros fifty" | twenty euros fifty |
| Percentage | "about fifty percent" | about fifty percent |
| Phone/code read out | "oh seven seven, double four" | oh seven seven double four |
| Ordinal | "the third time" | the third time |

#### ❌ Don'ts

- No digits: 306, 9:30, 3.5 never appear in a transcript.
- No symbols: percent signs, currency signs, plus signs are always written as the words that were spoken.
- No form conversion: if the speaker said "three oh six," do not write "three hundred six" — and vice versa.

---

## Section 11 — Letters and Acronyms

Acronyms and letter sequences can be spoken two different ways — here's how to tell them apart on the page.

| How it is spoken | How to write it | Examples |
|---|---|---|
| Read out letter by letter | Uppercase letters separated by spaces | I D · U R L · A P I |
| Pronounced as a word | Its normal written form | NASA · JSON · UNESCO |
| Plural or inflected letters | Marker follows the last letter | I D s · A P I s |
| A name spelled aloud | Same spaced capitals | M A R I A |
| A single letter | One capital | plan B · vitamin C |
| Mixed in one file | Follow the ear each time | "V I P" then "VIP" — both stand, as spoken |

| You hear | Correct | Incorrect |
|---|---|---|
| "my I D expired" | My I D expired. | My ID expired. |
| "we use jason for the config" (JSON as a word) | We use JSON for the config. | We use J S O N for the config. |
| "her name is spelled a n n a" | Her name is spelled A N N A. | Her name is spelled Anna. |

---

## Section 12 — Punctuation

Punctuation is there for readability, not grammatical perfection. Use the small core set below, place it at natural sentence and clause boundaries, and stop there.

| Mark | Used for | Example |
|---|---|---|
| . period | End of a statement — including an unfinished one | I thought we could. |
| ? question mark | Questions, by intonation or form | You did? |
| ! exclamation | Clear exclamations — use sparingly | Watch out! |
| , comma | Natural pauses, lists, direct address | Anna, are you there? |
| ' apostrophe | Contractions and possessives | don't · Anna's |
| -hyphen | Only inside dictionary-listed compounds | part-time · check-in |

#### ❌ Don'ts

- Banned in transcripts: colons, semicolons, quotation marks, parentheses, dashes, ellipses.
- Spoken punctuation and symbols are words: "anna dot lee at gmail dot com" is never written as an email address; "fifty percent" is never written as "50%."
- Do not punctuate hesitations into sentences of their own — punctuation follows meaning, not pauses.

> **Important Note**: Your language's punctuation particulars (inverted marks, full-width forms, spacing rules) are in your profile — see Section 23.

---

## Section 13 — Names and Brands

Names and brands come with their own small set of rules — and one of them previews a bigger topic coming up in Module 6.

- **People**: use the standard or most common spelling of the name, and keep it identical for the same person through the whole file. A quick search is fine; if it stays uncertain, best guess or use `<unclear>name</unclear>`.
- **Public figures, places, titles**: use the official spelling.
- **Brands and products**: official casing and spelling win, including mid-word capitals: eBay, iPhone. Stylized digits and symbols are written as pronounced: seven eleven, C plus plus.
- **Nicknames and pet names** are transcribed as heard, capitalized as names.
- **Names never take language tags** on their own, however foreign they sound — unless they sit inside a larger tagged span, where they simply stay.

| You hear | Correct | Incorrect |
|---|---|---|
| "ask kathryn — or katherine?" | Pick one plausible spelling, keep it all file long | Kathryn in one segment, Katherine in the next |
| "i bought it on ebay" | I bought it on eBay. | I bought it on Ebay. |
| "call me tommy" | Call me Tommy. | call me tommy |
| a surname you cannot catch | Mister `<unclear>Kowalski</unclear>` called again. | Mister Kowalski called again. (unmarked guess) |
| name inside an English span | `<cs:en>`ask Priya about the deck`</cs:en>` | `<cs:en>`ask `</cs:en>`Priya`<cs:en>` about the deck`</cs:en>` |

Now for the first real judgment call in this course: telling an interjection apart from a filler.

---

## Section 14 — Interjections

An interjection is a short word that **expresses something** — agreement, surprise, pain, disgust, relief. Interjections carry meaning, so they are ordinary words: written plainly, in the spelling your reference dictionary gives, never tagged.

| Expresses | Common interjections |
|---|---|
| Agreement / acknowledgement | mhm · uh-huh · yep · right |
| Disagreement | nuh-uh · nope |
| Surprise / realization | oh · whoa · wow |
| Pain / discomfort | ouch · ow |
| Disgust / frustration | ugh · yuck |
| Relief / consideration | phew · hmm |

The same sound can be an interjection or a filler — the difference is the context, and the markup makes your decision explicit: stalling → inside `<filler>`; responding → a plain word. Ask: is the speaker stalling, or responding?

| You hear | Correct | Incorrect |
|---|---|---|
| hm while thinking: "hm we could uh wait" | `<filler>Hm</filler>` we could `<filler>uh</filler>` wait. | Hm we could wait. (untagged stall) |
| hmm reacting: "Hmm, interesting." | Hmm, interesting. | `<filler>Hmm</filler>`, interesting. (a reaction is not a filler) |
| "uh-huh, I agree" | Uh-huh, I agree. | `<filler>Uh-huh</filler>`, I agree. |

---

## Section 15 — Code-Switching — `<cs:xx>`

Wrap every stretch spoken in a language other than the primary language in `<cs:xx>…</cs:xx>`, using that language's ISO 639 code. The tag opens exactly where the switch starts and closes exactly where it ends: one word, a phrase, or several sentences. In code-switching recordings the switch is almost always English (`<cs:en>`); other languages work identically (`<cs:fr>`, `<cs:yue>…`), and a switch whose language cannot be identified is `<cs:und>`.

| Situation (gloss) | Correct | Incorrect |
|---|---|---|
| One English word inside Mandarin — "send me the slides" | 帮我把`<cs:en>`slides`</cs:en>`发一下。 | 帮我把slidess发一下。 |
| An English phrase inside German — "we just say let's move on" | Wir sagen einfach `<cs:en>`let's move on`</cs:en>`. | Wir sagen einfach let's move on. |
| A whole English sentence inside French — "and she said: not my problem" | Et elle a dit, `<cs:en>`not my problem.`</cs:en>` | Et elle a dit, not my problem. |
| An English switch you cannot make out | Er sagte `<cs:en><unclear/></cs:en>` und ging. | Er sagte und ging. (switch dropped) |

### Rules inside the tags — these apply every time you use a `<cs:en>` tag:

- Write the embedded language in its own standard spelling — never re-spell it phonetically in the primary language's script.
- The embedded language's punctuation goes inside the tags: `<cs:es>`¿verdad?`</cs:es>`
- The tag wraps only the embedded-language material. Where primary-language grammar attaches directly to an embedded word, three cases:
  1. Native clitic or elided article in front — French l', d', qu'; Italian l', un'; Dutch 't. The clitic is primary-language: it stays outside, and the tag opens after the apostrophe.
     - Il faut valider l'`<cs:en>`onboarding`</cs:en>`.
  2. Native suffix after — Turkish, Korean, Japanese and Hindi case and verb endings. The suffix stays outside the tag.
     - O `<cs:en>`meeting`</cs:en>`'i erteledik.
  3. Native affixes on both sides — German ge-…-t, Dutch ge-…-d. The tag cannot be split around the root, so the word counts as a primary-language hybrid: no tag, and add it to the exception list.
     - Das Meeting ist gecancelt.
- Inflection travels with the word: plurals, -ing, and -ed forms are part of it —
  `<cs:en>`deadlines`</cs:en>`, never `<cs:en>`deadline`</cs:en>`s; 我们还在 `<cs:en>`brainstorming`</cs:en>`.
- Numbers inside a span follow the embedded language: `<cs:fr>`quatre-vingts`</cs:fr>`, not a translation.
- Open and close within the same segment, and keep the segment's languages field in step (Section 4).
- Nesting order when tags combine: language outside, overlap inside — `<cs:en>`you know `<overlap>`what I mean?`</overlap></cs:en>`. Where an overlap begins or ends inside a `<cs:>` span rather than enclosing it, close and reopen the overlap tag at the language boundary so that nesting order is preserved: 我觉得`<overlap>`这个`</overlap><cs:en><overlap>`deadline`</overlap></cs:en>`太紧了。 The language tag is never split.

### Names, borrowings, and hybrid words — apply these tests in order; the first one that matches decides:

**NAME TEST** | A person, place, brand, or title inside primary-language speech → **no tag**. Inside a longer tagged span, it simply stays in the span.

**BORROWING TEST** | Listed in your reference dictionary as an established borrowing and said the nativized way → **no tag**, spelled the native way — the way "kindergarten" and "karaoke" are simply English words in English. Deliberately produced with the embedded language's pronunciation instead → **tag it**, spelled in the embedded language.

**HYBRID-SCRIPT TEST** | A fixed native word that happens to contain Latin letters → **no tag**.

**UNSURE?** | **Do not tag**. Recurring judgment calls go on the shared exception list, so the whole team handles the same word the same way.

### Additional cases:

| Case | Rule | Example |
|---|---|---|
| Entire segment is English | Tag the whole text; the languages field lists what is actually spoken | `<cs:en>`Wait, I'm coming.`</cs:en>` |
| Back-to-back switches | Each switch gets its own tags | 也行，`<cs:en>`long story short`</cs:en>`，我们就`<cs:en>`go for it`</cs:en>`。 |
| A quoted English title | Titles are names — name test wins, no tag | Wir haben gestern Top Gun geschaut. |
| A name inside a span | Stays inside the span, untagged itself | `<cs:en>`just ask Priya about the deck`</cs:en>` |
| Filler inside a span | Embedded language's filler spelling, tagged normally | `<cs:en>`it's `<filler>`um`</filler>` optional`</cs:en>` |
| Common acronyms read out (A P I, U R L, K P I) | Letter sequences are language-neutral — spaced capitals, no cs tag | 先看一下A P I的文档。 |
| Language identifiable, content not | Tag the language, mark the content unclear | `<cs:en><unclear/></cs:en>` |
| A switch into some other language, not English | Same mechanics — that language's ISO code, and it joins the segment's languages field | she just said `<cs:fr>`c'est la vie`</cs:fr>` and left |

> **Important Note**: Every language present in a segment must appear in its languages field.

Code-switching is the densest topic in this course — nice work getting through it. Module 7 covers three more tags that are easy to confuse with what you just learned.

---

## Section 16 — Fillers `<filler>`

A filler is a wordless hesitation sound: uh, um, er. It does not carry meaning. Wrap every filler in `<filler>…</filler>`, using the normalized spelling from your language's inventory (Section 21) so the same sound is always written the same way.

#### ✅ Do's

- Tag every occurrence, however many: `<filler>uh</filler>` `<filler>uh</filler>` right here.
- Inside an English switch, use the English spellings: `<cs:en>`it's `<filler>um</filler>` optional`</cs:en>`.
- Turn-initial hesitations count too: `<filler>Um</filler>` so about tomorrow.
- A hesitation sound none of the inventory spellings fits: it still gets the tag — add a simple spelling and reuse it every time it recurs.

#### ❌ Don'ts

- Real words — you know, like, well, so, and their equivalents in every language — are never fillers, however the speaker uses them. They are always written as plain words.
- Reactions (mhm, hmm, oh) are interjections — plain words. (Cross-reference: this distinction is covered fully in Section 14.)
- An audible breath is not a filler — it is a vocal tag. (Cross-reference: the vocal tag is covered in Section 20.)
- Never invent spellings: umm, uhhh, errr do not exist; the inventory spelling does.

| You hear | Correct | Incorrect |
|---|---|---|
| "um we should uh get started" | `<filler>Um</filler>` we should `<filler>uh</filler>` get started. | Um we should uh get started. (untagged) |
| "it's er it's upstairs" | It's `<filler>er</filler>` it's upstairs. | It's upstairs. (dropped) |
| "uhhhh" (long drawn-out) | `<filler>uh</filler>` | `<filler>uhhhh</filler>` |

Fillers are wordless sounds — next, let's look at what happens when a word itself gets cut off mid-way.

---

## Section 17 — Cut-off Words `<cut>`

When a word is broken off — the speaker abandons it, restarts it, or the segment boundary clips it — wrap exactly the audible fragment in `<cut>…</cut>`. Write only what was actually said: never complete the word for the speaker.

#### ✅ Do's

- Works at either end: end cut — `<cut>defi</cut>` definitely; start cut — `<cut>cause</cut>` I was late.
- Stutter chains: each fragment gets its own tag → `<cut>n</cut>` `<cut>n</cut>` no.
- A word clipped by the segment edge is also `<cut>`.

#### ❌ Don'ts

- Do not guess the intended word — write only the audible fragment.
- Elongation is not truncation: "sooooo" is the word so, written so.
- A completed word in a false start is not cut — it is just a word. (Cross-reference: this is the false-start rule from Section 7.)

| You hear | Correct | Incorrect |
|---|---|---|
| "we should defi- definitely go" | We should `<cut>defi</cut>` definitely go. | We should definitely go. |
| "'cause I was late" | `<cut>cause</cut>` I was late. | Because I was late. |
| "n- n- no way" | `<cut>n</cut>` `<cut>n</cut>` no way. | No way. |
| "they wanted to…" (audio ends mid-word "celebr-") | They wanted to `<cut>celebr</cut>` | They wanted to celebrate. |

---

## Section 18 — Unclear Speech `<unclear>`

After two or three listens, mark what you cannot make out with `<unclear>` tag. If you have a reasonable guess, put it inside the tag: `<unclear>`next Tuesday`</unclear>`. Any plausible guess is acceptable.

#### ✅ Do's

- Mark the **smallest stretch** you actually cannot hear — the unclear words, not the whole sentence.
- One continuous unclear stretch = one tag, not several in a row.
- Unidentifiable foreign speech combines with the language tag: `<cs:und><unclear/></cs:und>`.
- A name you cannot catch: Mister `<unclear>`Kowalski`</unclear>` called.

| Situation | Correct | Incorrect |
|---|---|---|
| Two words lost to noise | Put it `<unclear/>` the shelf. | Put it ??? the shelf. |
| Probably "next Tuesday" | See you `<unclear>`next Tuesday`</unclear>`. | See you next Tuesday. (unmarked guess) |
| Whole stretch gone | `<unclear/>` | Leaving the segment empty |
| Only the middle is lost | She said `<unclear/>` and left early. | `<unclear>`She said something and left early`</unclear>` |
| Heard clearly, two words fit | The likelier one, written plainly | Marked unclear (not an audio problem) |

---

## Section 19 — Overlapping Speech `<overlap>`

In natural conversation, people talk over each other. Overlap is recorded twice, and both layers are required: in time — the two Speech segments overlap on the timeline — and in text — the simultaneous words are wrapped in overlap tags in both segments.

| Situation | What to do |
|---|---|
| Both speakers say something substantive at once | Each gets their own time-overlapping segment; the simultaneous words wrapped in `<overlap></overlap>` in both |
| A short backchannel over the main speaker ("yeah", "mhm") | Same treatment — own segment, overlap tags in both |
| Overlap starts or ends mid-word | Tags never split a word: starting mid-word → `<overlap>` before the word; ending mid-word means it goes after |
| A faint voice not worth its own segment | [background-speech] at that spot in the main transcript |
| Three or more voices, inseparable | One NonSpeech segment over the pile-up — do not spend multiple listens untangling it |

#### ❌ Don'ts

- Do not transcribe crowds or bystanders — only identified speakers of interest get Speech segments.
- Do not open an overlap tag in one segment without closing it in the same segment.
- Do not tag overlap in only one of the two segments — both sides carry it.

### Worked example: S2 agrees while S1 is still finishing the question — the last words of S1 and all of S2 are simultaneous

| | Speaker S1 | Speaker S2 |
|---|---|---|
| Time | 128.400 to 134.900 | 133.800 to 134.700 |
| Text | So we'd push the deadline, `<overlap>`if that works?`</overlap>` | `<overlap>`Yeah, absolutely`</overlap>` |
| Note | Only the actually-simultaneous words are inside the tags | The whole backchannel is simultaneous, so all of it is tagged |

Overlap is one kind of non-speech-adjacent event — next, let's cover the other sounds that show up in real audio.

---

## Section 20 — Non-Speech Events

Six standalone tags cover every audible non-speech event. Insert the tag at the position where the sound happens. Anything not listed is simply a noise tag.

| Tag | Covers | Example in context |
|---|---|---|
| [laughter] | Laughing, chuckling — the speaker's or another participant's | That was [laughter] unbelievable. |
| [vocal] | The speaker's own non-word sounds: cough, sneeze, throat-clearing, audible breath, yawn | Sorry [vocal] where were we? |
| [noise] | External sounds — the catch-all: clicks, rings, bangs, traffic, beeps | Hold on [noise] okay go ahead. |
| [music] | Foreground music with nobody speaking (1 second or more) | [music] Welcome back! |
| [pause] | A silent gap of 2 seconds or more inside a segment | They're not [pause] coming. |
| [background-speech] | A faint voice that is not a participant, or not worth its own segment | So anyway [background-speech] as I said. |

#### ✅ Do's

- A sound repeating in a burst (click click click) is tagged once.
- A sound landing inside a word: write the word whole, put the tag before it. Never split a word.
- [vocal] is for the participants' own sounds; anything from outside the conversation is [noise] or [background-speech].

#### ❌ Don'ts

- Do not tag lipsmacks, small mouth noises, or faint background hum.
- Do not invent tags: [door], [sigh], [ring] do not exist here — they are all [noise].
- Do not tag quiet background music under speech — transcribe the speech and ignore the music.

### Where common sounds go:

| You hear | Write |
|---|---|
| Throat-clearing, coughing, sneezing, an audible breath, yawning | [vocal] |
| Laughing, chuckling | [laughter] |
| Keyboard, door, phone ringing, notification sounds, traffic, a dog | [noise] |
| A TV or radio with audible speech in it | [background-speech] |
| Someone speaking over background music | Transcribe the speech — no [music] |
| A long silent stretch inside a segment | [pause] (≥ 2 s), past ~3 s end the segment instead |
| Lipsmacks, faint hum, barely audible anything | Nothing — not tagged |

> **Important Note**: The [noise] tag is the catch-all for anything not explicitly listed — this includes sounds you might expect to have their own tag, like a door or a sigh.

---

## Section 21 — Markup Inventory: Filler Inventory Table

Everything that may appear in a transcript besides the words themselves is listed here. No other markup may appear in a transcript.

### PAIRED TAGS

| Tag | Function | Example |
|---|---|---|
| `<cs:xx>` … `</cs:xx>` | Code-switch span — cs: plus the ISO code of the embedded language (en, ko, yue, and so on) | 帮我把 `<cs:en>`slides`</cs:en>`发一下 |
| `<cs:und>` … `</cs:und>` | Switch into a language the annotator cannot identify | `<cs:und><unclear/></cs:und>` |
| `<overlap>` … `</overlap>` | Words spoken simultaneously with another speaker — in both segments | `<overlap>`Yeah, absolutely`</overlap>` |
| `<filler>` … `</filler>` | Filler — wordless hesitation sound; spelled per the inventory below | `<filler>um</filler>` · `<filler>er</filler>` |
| `<cut>` … `</cut>` | Cut-off word — the spoken fragment goes inside, whether the start or the end was cut | `<cut>defi</cut>` definitely |
| `<unclear>` … `</unclear>` | Unintelligible speech — best guess inside, or empty | `<unclear>`next Tuesday`</unclear>` |

### NON-SPEECH TAGS

*(Referência às 6 tags: [laughter], [vocal], [noise], [music], [pause], [background-speech] — ver Seção 20)*

### FILLER INVENTORY

*(Inventário normalizado de preenchimentos por idioma — ver perfil do idioma, Seção 23)*

### STRUCTURAL RULES

*(Regras estruturais aplicam-se conforme definido em cada seção)*

---

## Perfis de idiomas e encerramento do curso

Um perfil por idioma do programa, contendo apenas o que é específico daquele idioma; tudo o que não é mencionado segue as regras básicas. Uma subseção variante (por exemplo, es-US em espanhol) contém apenas o que difere de seu perfil pai — leia primeiro o perfil pai e depois a variante. Os dicionários de referência são obras lexicográficas públicas, utilizadas exclusivamente como autoridades ortográficas.

---

## Português (pt-BR)

| Campo | Detalhes |
|---|---|
| Dicionário | Michaelis (michaelis.uol.com.br); Aulete Digital; VOLP (Academia Brasileira de Letras) para ortografia. |
| Roteiro | Português Latin incl. ã o ç á í é ó ú â ê ô ü à |
| Pontuação | . , ! ? e apóstrofo |
| Soletrações de hesitação | ah ehh é ã ahm |

- **Capitalização**: nomes próprios e iniciais de frases; nomes de lugares mantêm o artigo falado; siglas em maiúsculas (FUNAI); minúsculas em dias úteis (quinta-feira).
- **Números**: escritos como falados — cinco, quinto, trezentos e seis ou três zero seis dependendo de como foi dito; sequências de dígitos lidas dígito por dígito (nove dois um zero).
- **Contrações**: contrações escritas mantidas como palavras únicas como faladas: pra(s), pro(s), dum, duma(s), noutro(s), doutro(s), deste(s), nisso.
- **Interjeições**: palavras simples na grafia padrão (ai, opa, puxa, uau, uê, aham, uhum, eita) — não preenchimentos.

**O limite do interruptor.** O português brasileiro absorve o inglês rapidamente em tecnologia e trabalho — delete, mouse, site, internet, printar são portugueses do dia a dia e permanecem sem tags. Frases e cláusulas genuínas em inglês estão marcadas.

| Você ouve | Correto | Incorreto |
|---|---|---|
| "Falei gentilmente; vamos seguir em frente e logo" | Falei tipo `<cs:en>`vamos em frente`</cs:en>` e em breve. | Falei gentilmente, vamos em frente logo. |
| "vou deletar o arquivo" | Vou deletar o arquivo. (Michaelis-listed) | Vou `<cs:en>`deletar`</cs:en>` o arquivo. |

---

## Quick Reference — all markup on one page:

| Markup | Meaning | Example |
|---|---|---|
| `<cs:xx>` … `</cs:xx>` | Code-switch span — cs: plus ISO code (open where it starts, close where it ends) | 帮我把`<cs:en>`slides`</cs:en>`发一下 |
| `<cs:und>` … `</cs:und>` | Switch, language unidentifiable | `<cs:und><unclear/></cs:und>` |
| `<overlap>` … `</overlap>` | Words simultaneous with another speaker — in both segments | `<overlap>`Yeah, absolutely`</overlap>` |
| `<cut>` … `</cut>` | Cut-off word — the spoken fragment inside | `<cut>defi</cut>` definitely |
| `<unclear>` … `</unclear>` | Unintelligible; guess inside, or empty | `<unclear>`next Tuesday`</unclear>` |
| [6 tags] | laughter, vocal, noise, music, pause, background-speech | Noise is the catch-all |
| `<filler>` … `</filler>` | Wordless hesitation sound, normalized spelling (real stalling words stay plain) | `<filler>um</filler>` · `<filler>er</filler>` |
| Letters read out | Uppercase plus spaces | A P I · I O s |
| Said as a word | Normal written form | NASA · JSON |

---

## Resumo Final — Do's e Don'ts

#### ✅ Do's

- Verbatim always — errors, repeats, fillers and all.
- Speech segments ≤ 20 s; boundaries tight (≤ 0.3 s padding); never cut a word.
- One speaker per segment; simultaneous words wrapped in `<overlap>` in both segments.
- Numbers in words, exactly as spoken.
- Tags open and close in the same segment; the languages field always matches.

#### ❌ Don'ts

- Never tag names or dictionary loanwords as code-switches.
- Never re-spell embedded speech phonetically in your own script.
- Never leave a filler untagged — and never tag a meaningful word as one.
- Never use digits — anywhere.
- Never assume PII only applies to the speaker — real personal identifiers (names, addresses, phone/email, ID/account, financial or medical details) trigger a reject whether they belong to the speaker or to someone else mentioned.
