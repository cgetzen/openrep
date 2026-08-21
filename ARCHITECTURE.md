# OpenRep Architecture

This document records the intended domain boundaries and future evolution of OpenRep. `AGENTS.md` contains the standing implementation rules; this file expands the architecture diagrams those rules refer to.

## 1. Two separate systems: content generation and runtime training

OpenRep should treat repertoire discovery as an offline/content-generation concern and training as a deterministic runtime concern.

```mermaid
flowchart LR
  subgraph Generation["Offline / content-generation time"]
    DB["Opening database snapshot\nfrequency by cohort"]
    POLICY["Generation policy\ncoverage targets + repertoire preferences"]
    SF["Stockfish / theory\nquality + candidate ranking"]
    EXPAND["Position-graph expansion\nand transposition collapse"]
    CLUSTER["Curriculum clustering\nprimary family + concept tags"]
    CANDIDATE["Candidate content artifact\npositions + responses + evidence + curriculum"]

    DB --> EXPAND
    POLICY --> EXPAND
    SF --> EXPAND
    EXPAND --> CLUSTER
    CLUSTER --> CANDIDATE
  end

  CANDIDATE --> PR["Reviewable Git diff / draft PR"]
  PR --> SNAPSHOT["Committed versioned content snapshot"]

  subgraph Runtime["Browser runtime"]
    SNAPSHOT --> COURSE["Course content"]
    COURSE --> INDEX["Position graph / response registry"]
    COURSE --> CURR["Curriculum metadata"]
    INDEX --> TRAINER["Learn / Practice trainer"]
    CURR --> TRAINER
    PROGRESS["Learner progress\nline attempts + learned response IDs"] --> TRAINER
  end
```

### Boundary rule

The browser runtime must not decide what repertoire ought to exist. It consumes accepted, versioned content. Opening-database queries, broad engine searches, coverage optimization, and automatic clustering belong before the Git snapshot boundary.

A routine production build should not silently regenerate curriculum from live external data. A scheduled/manual generator may refresh evidence and propose changes, but material changes should arrive as a reviewable PR.

## 2. Stable identity versus metadata

```mermaid
flowchart TB
  POS["Position identity\nnormalized chess state"]
  RESP["Response identity\n(position, opponent move)"]
  LINE["Line identity\nstable lineId"]
  PROG["Progress identity\nlineId / responseId"]

  FAMILY["Primary curriculum family\nexclusive course-map placement"]
  CONCEPT["Concept tags\nnon-exclusive pedagogical membership"]
  EVIDENCE["Evidence\nfrequency + cohort + engine/theory provenance"]
  OWNER["Teaching ownership\none owner, many applicable routes"]
  PRESENT["Presentation\ntier, order, labels, copy"]

  POS --> RESP
  RESP --> PROG
  LINE --> PROG

  LINE -. metadata .-> FAMILY
  RESP -. metadata .-> FAMILY
  LINE -. metadata .-> CONCEPT
  RESP -. metadata .-> CONCEPT
  POS -. metadata .-> EVIDENCE
  RESP -. metadata .-> EVIDENCE
  RESP -. metadata .-> OWNER
  FAMILY -. metadata .-> PRESENT
```

Identity must not depend on database source, engine version, curriculum tier, family, teaching owner, authoring anchor, or UI placement.

### Primary families versus concepts

A line belongs to exactly one primary curriculum family so the course map has a deterministic home for it. A response may also have at most one primary family when surfaced directly in the curriculum.

Concept tags are deliberately many-to-many. A line can simultaneously be an Exchange structure, a transposition-recognition example, and a move-order lesson. Do not overload primary families to represent every pedagogical relationship.

## 3. Runtime domain model

```mermaid
classDiagram
  class Course {
    +id
    +lines[]
    +responses[]
    +curriculum
  }

  class Line {
    +lineId
    +moves[]
    +notes
  }

  class PositionNode {
    +positionKey
  }

  class Response {
    +responseId
    +positionKey
    +opponentMove
    +repertoireMove
    +teachingOwnerLineId
  }

  class Curriculum {
    +schemaVersion
    +courseId
    +tiers[]
    +families[]
    +concepts[]
    +evidence
  }

  class Family {
    +id
    +tier
    +lineIds[]
    +responseIds[]
  }

  class Concept {
    +id
    +lineIds[]
    +responseIds[]
  }

  Course "1" o-- "many" Line
  Course "1" o-- "many" Response
  Course "1" o-- "1" Curriculum
  Curriculum "1" o-- "many" Family
  Curriculum "1" o-- "many" Concept
  Line --> PositionNode : traverses
  Response --> PositionNode : anchored by identity
```

`PositionNode` is the conceptual long-term graph primitive. Today many runtime positions are reconstructed from authored line paths; future generated content may materialize position nodes directly. The runtime index should remain a coverage/query layer over shipped content, not become the discovery engine.

## 4. Content-generation lifecycle

A future generator should follow this lifecycle:

```mermaid
flowchart TD
  START["Choose opening + target cohort"]
  DECISIONS["Enumerate major opponent decision positions"]
  FREQ["Attach opponent-move frequencies"]
  COVERAGE["Select 80 / 90 / 95% practical coverage candidates"]
  RESPONSE["Choose repertoire responses\nStockfish + opening theory + complexity policy"]
  EXPAND["Expand resulting positions"]
  TRANSPOSE["Collapse equivalent normalized positions"]
  CLUSTER["Assign primary families + concept tags"]
  ARTIFACT["Emit deterministic content artifact + provenance"]
  TEST["Run identity, legality, coverage, transposition, and UI tests"]
  PR["Open/update reviewable PR"]

  START --> DECISIONS --> FREQ --> COVERAGE --> RESPONSE --> EXPAND --> TRANSPOSE --> CLUSTER --> ARTIFACT --> TEST --> PR
```

The generator should be deterministic for the same:
- external data snapshot;
- cohort definition;
- engine version/settings;
- generation-policy version;
- curated overrides.

Generated output should record those inputs as provenance. Do not commit an entire external opening database when a compact evidence snapshot is sufficient to explain/reproduce accepted decisions.

## 5. Repertoire choice is separate from opponent coverage

A position can have multiple objectively sound repertoire candidates even though the shipped course chooses one primary move.

```mermaid
flowchart LR
  P["Position"] --> O1["Opponent move A"]
  P --> O2["Opponent move B"]
  O1 --> R1["Primary repertoire response"]
  O1 -. optional .-> R2["Alternative repertoire response"]
  O2 --> R3["Primary repertoire response"]

  R1 -. curriculum .-> CORE["Primary family"]
  R2 -. curriculum .-> ALT["Alternative / on-demand family"]
```

Future user-selectable repertoires should introduce an explicit repertoire-choice/configuration layer rather than changing position identity or response identity.

## 6. Personalization

Personalization should normally re-rank or re-tier accepted content rather than regenerate chess identity in the browser.

```mermaid
flowchart LR
  GRAPH["Canonical shipped repertoire graph"]
  COHORT["User cohort / encounter frequencies"]
  HISTORY["Learner weakness + spaced-review state"]
  POLICY["Presentation policy"]

  GRAPH --> VIEW["Personalized curriculum view"]
  COHORT --> VIEW
  HISTORY --> VIEW
  POLICY --> VIEW
```

Examples:
- a move can be `Important` for 1200 Blitz and `On demand` for 2200 Classical;
- weak/spaced scheduling can prioritize a specific leaf without changing its family;
- a future selected repertoire can hide alternatives while preserving stable content IDs.

## 7. Current module boundary

- `src/curriculum.js`: opening-agnostic curriculum validation, ordering, course decoration, concept lookup, teaching-unit ordering, and canonical teaching-unit presentation.
- `src/lesson-session.js`: opening-agnostic lesson-entry invariants: teaching unit, origin, start ply, and optional parent.
- `src/lesson-session-trainer.js`: application/session layer that keeps teaching-unit identity, entry context, and route execution separate.
- `src/curriculum-trainer.js`: opening-agnostic rendering/interaction for a course that has curriculum metadata and a teaching-unit Learn sequence.
- `src/openings/*-curriculum.js`: opening-specific curriculum data and evidence snapshots.
- `src/repertoire-moves.js`: runtime coverage/response index over shipped content.
- future `content-generator/` (or equivalent): database adapters, engine analysis, expansion, coverage optimization, clustering, artifact emission.

When adding another opening, reuse the generic curriculum/session modules; do not fork Caro-Kann-specific validator/builder/trainer logic.

## 8. Teaching-unit identity, lesson session, and route execution are separate

A learner can reach the same response from several entry points: the curriculum map, an opponent-alternative panel, a completed-line response list, a transposed lesson, or future search/personalization UI. Those entry points share teaching identity but can require different start and completion behavior.

```mermaid
flowchart LR
  RESP["Stable responseId"] --> UNIT["Teaching unit\nresponse:<responseId>"]
  FAMILY["Primary curriculum family"] --> PRESENT["Canonical presentation\ntitle + tier + role"]
  UNIT --> PRESENT

  MAP["Curriculum map"] --> ENTRY["Entry context"]
  ALT["Opponent alternative"] --> ENTRY
  SUMMARY["Response summary"] --> ENTRY
  PRACTICE["Practice queue"] --> ENTRY

  UNIT --> SESSION["Lesson session"]
  ENTRY --> SESSION
  SESSION --> START["startPly"]
  SESSION --> PARENT["optional parent session"]
  SESSION --> NAV["next / return behavior"]

  UNIT --> ROUTE["Route\nchess reconstruction + divergence"]
  SESSION --> ROUTE
  ROUTE --> TRAIN["Board / move playback / progress"]
  PRESENT --> UI["Learner-facing lesson UI"]
  TRAIN --> UI
```

The three questions must remain independent:

1. **What is being learned?** — the stable teaching unit (`line:<lineId>` or `response:<responseId>`).
2. **How did the learner enter it?** — lesson-session context (`origin`, `startPly`, optional parent, navigation behavior).
3. **How is the chess position reconstructed/executed?** — the route and its `divergencePly`, owner line, and move sequence.

### Session invariants

- `responseId` identifies a response teaching unit; `lineId` identifies a line teaching unit.
- `sessionRoute.kind`, `teachingOwnerLineId`, authoring anchor, and `divergencePly` are route/authoring mechanics. They do not determine lesson identity, start position, or completion navigation.
- A curriculum-map response is a **root lesson session**: `origin = curriculum`, `parent = null`, and `startPly = 0`. It begins from the course root even if its response route diverges later.
- An opponent-alternative or completed-line response is an **embedded response session**: `origin = embedded-response`, it requires an explicit parent-session snapshot, and it may start at `divergencePly` because the learner already reached that context.
- **Return to lesson exists if and only if an explicit parent session exists.** A response route by itself must never imply return behavior.
- Restart uses the lesson session's `startPly`; it must not infer start position from route kind or `divergencePly`.
- Returning from an embedded response restores the exact parent route/session state that was left, not merely the parent line's title or canonical route.
- Curriculum Learn navigation is an ordered sequence of teaching units, not an index over `course.lines`. First-class response lessons participate in Previous/Next just like full-line lessons.
- A route may still use a teaching-owner line to reconstruct prefix moves. That owner is hidden execution context and must not become current-item highlighting, lesson navigation, or learner-facing identity.

### Example: Accelerated Panov

```mermaid
sequenceDiagram
  participant U as Learner
  participant C as Curriculum
  participant S as Lesson session
  participant R as Response route

  U->>C: Select 2.c4 — Accelerated Panov
  C->>S: response:accelerated-panov-c4\norigin=curriculum, startPly=0, parent=null
  S->>R: Execute route from root
  R-->>U: 1.e4
  U->>R: c6
  R-->>U: 2.c4
  U->>R: d5
  S-->>U: Lesson complete → Next lesson
```

The same response opened from an in-line opponent-alternative panel can use `startPly = divergencePly` and show `Return to lesson` after completion because that session has an explicit parent. The teaching-unit title and progress identity remain the same.
