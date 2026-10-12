import json
from typing import Any

from app.ai.provider import (
    BlueprintRequest,
    CurriculumRequest,
    CurriculumTopicSummary,
    MentorRequest,
)
from app.ai.schemas import (
    BLUEPRINT_SCHEMA_VERSION,
    CURRICULUM_SCHEMA_VERSION,
    MAX_MENTOR_REPLY_LENGTH,
    MENTOR_SCHEMA_VERSION,
    TechCategory,
)
from app.services.curriculum_service import generate_project_topics

# Limits of BlueprintOutputV2 that user-entered text has to be fitted into.
_NAME_LIMIT = 80
_TITLE_LIMIT = 120
_SHORT_LIMIT = 240
_DESCRIPTION_LIMIT = 500
_MAX_TECH_CHOICES = 12
_MAX_PHASE_TOPICS = 4

#: First match wins, so the narrower roles are checked before the broader ones.
_CATEGORY_KEYWORDS: tuple[tuple[TechCategory, tuple[str, ...]], ...] = (
    ("authentication", ("clerk", "auth0", "firebase auth", "cognito", "oauth", "jwt")),
    ("ai", ("gemini", "openai", "gpt", "claude", "anthropic", "llm")),
    ("realtime", ("socket.io", "websocket", "pusher", "ably")),
    ("storage", ("amazon s3", "aws s3", "cloudinary", "cloud storage", "firebase storage")),
    ("testing", ("jest", "pytest", "cypress", "playwright", "vitest", "testing library")),
    ("infrastructure", ("docker", "kubernetes", "aws", "azure", "google cloud", "vercel", "railway")),
    ("database", ("mongo", "postgres", "mysql", "sqlite", "redis", "supabase", "firestore")),
    ("backend", ("fastapi", "django", "flask", "node", "express", "nestjs", "spring", "rails")),
    ("frontend", ("react", "expo", "next", "vue", "angular", "svelte", "flutter", "tailwind")),
)

_PURPOSES: dict[TechCategory, str] = {
    "frontend": "Builds the {platforms} interface of {name}.",
    "backend": "Serves the API and business logic of {name}.",
    "database": "Stores the data of {name}.",
    "authentication": "Signs users in to {name} and protects their data.",
    "ai": "Provides the AI features of {name}, called only from the backend.",
    "storage": "Stores the files and media of {name}.",
    "realtime": "Pushes live updates to the users of {name}.",
    "infrastructure": "Builds, hosts and deploys {name}.",
    "testing": "Verifies the features of {name} automatically.",
    "other": "Supports {name}.",
}

#: Only for roles whose integration is a security boundary.
_USER_INTEGRATION_NOTES: dict[TechCategory, str] = {
    "authentication": "The API verifies the session token it issues on every protected request.",
    "ai": "Called only by the API; its API key never reaches the client.",
}

#: Mainstream defaults for core roles the user's own stack leaves open. Each
#: says it is an assumption and names a real alternative with its trade-off.
_DEFAULTS: dict[str, dict[str, Any]] = {
    "mobile": {
        "category": "frontend",
        "name": "React Native",
        "rationale": "No frontend was specified, so React Native is assumed: one TypeScript "
        "codebase for Android and iOS.",
        "alternatives": [
            {
                "name": "Flutter",
                "tradeoff": "Choose it for a Dart team or highly custom rendering; it shares "
                "less with web React tooling.",
            }
        ],
        "integration_notes": "Talks only to the API over HTTPS.",
    },
    "web": {
        "category": "frontend",
        "name": "React",
        "rationale": "No frontend was specified, so React is assumed: a widely supported way "
        "to build a component-based web interface.",
        "alternatives": [
            {
                "name": "Vue",
                "tradeoff": "Choose it if the team already knows Vue; its component model and "
                "libraries differ from React's.",
            }
        ],
        "integration_notes": "Talks only to the API over HTTPS.",
    },
    "backend": {
        "category": "backend",
        "name": "FastAPI",
        "rationale": "No backend was specified, so FastAPI is assumed: typed, async Python "
        "APIs with built-in request validation.",
        "alternatives": [
            {
                "name": "Django REST Framework",
                "tradeoff": "Choose it for Django's built-in admin, ORM and migrations; it brings "
                "more framework than a small JSON API needs.",
            }
        ],
        "integration_notes": "The only component that reads or writes the database.",
    },
    "database": {
        "category": "database",
        "name": "MongoDB",
        "rationale": "No database was specified, so MongoDB is assumed: flexible documents "
        "suit data whose shape is still evolving.",
        "alternatives": [
            {
                "name": "PostgreSQL",
                "tradeoff": "Choose it when the data is strongly relational, e.g. orders and "
                "payments that need joins and transactions.",
            }
        ],
        "integration_notes": "Accessed only by the API, never by the client.",
    },
}

#: Generic implementation stages, each with its rationale, tasks and checks;
#: the curriculum topics applied in a phase become its learning links.
_PHASES: dict[str, dict[str, Any]] = {
    "foundation": {
        "title": "Foundations and core features",
        "goal": "Set up {name} and build its main user flow end to end.",
        "rationale": "A working skeleton and the core flow prove the data model before "
        "anything is polished.",
        "tasks": [
            "Create the app and API projects with linting, type checking and tests",
            "Model the core records of {name} and build the main flow against the API",
        ],
        "deliverables": ["The core flow of {name} works end to end"],
        "acceptance_criteria": [
            "The app starts and reaches the API",
            "A user can complete the main flow without errors",
        ],
        "tech_categories": ["frontend", "backend", "database"],
        "risks": ["Changing the data model later is costly; review it before adding features."],
    },
    "setup": {
        "title": "Foundations and setup",
        "goal": "Set up the projects, tooling and core data model of {name}.",
        "rationale": "Every later phase builds on a working skeleton and an agreed data model.",
        "tasks": [
            "Create the app and API projects with linting, type checking and tests",
            "Model the core records of {name} and connect the API to the database",
        ],
        "deliverables": ["A running app and API that build and pass their checks"],
        "acceptance_criteria": [
            "The app starts and reaches the API's health endpoint",
            "Lint, type checks and the first tests pass",
        ],
        "tech_categories": ["frontend", "backend", "database", "testing", "infrastructure"],
        "risks": ["Changing the data model later is costly; review it before adding features."],
    },
    "features": {
        "title": "Core features",
        "goal": "Build the main user flows of {name} end to end.",
        "rationale": "The core flows deliver the project's value and exercise the data model early.",
        "tasks": [
            "Build the main screens of {name} against real API endpoints",
            "Add validated create, read, update and delete endpoints for the core records",
        ],
        "deliverables": ["The core flows of {name} work end to end"],
        "acceptance_criteria": [
            "A user can complete each main flow without errors",
            "Invalid input is rejected with a clear message",
        ],
        "tech_categories": ["frontend", "backend", "database", "ai", "storage", "realtime"],
        "risks": [],
    },
    "integration": {
        "title": "Integration and persistence",
        "goal": "Secure {name} and connect it to the services it relies on.",
        "rationale": "Access control and integrations must be in place before real users and "
        "data arrive.",
        "tasks": [
            "Protect every user-specific endpoint and verify resource ownership",
            "Integrate the external services of {name} behind the API",
        ],
        "deliverables": ["Users can reach only their own data"],
        "acceptance_criteria": [
            "An unauthenticated request to a protected endpoint returns 401",
            "A user cannot read another user's records",
        ],
        "tech_categories": ["authentication", "backend", "database", "ai", "storage", "realtime"],
        "risks": [],
    },
    "release": {
        "title": "Quality and release",
        "goal": "Harden, test and release {name}.",
        "rationale": "Testing and error handling turn working features into a dependable release.",
        "tasks": [
            "Cover the critical flows with automated tests",
            "Add loading, empty and error states and prepare the release build",
        ],
        "deliverables": ["A tested release build of {name}"],
        "acceptance_criteria": [
            "The automated test suite passes",
            "Every screen handles loading, empty and error states",
        ],
        "tech_categories": ["testing", "infrastructure", "frontend"],
        "risks": [],
    },
}

_PHASE_PLANS: dict[int, tuple[str, ...]] = {
    2: ("foundation", "release"),
    3: ("setup", "features", "release"),
    4: ("setup", "features", "integration", "release"),
}

_PLATFORM_LABELS = {"android": "Android", "ios": "iOS", "web": "web"}

_MENTOR_OFFLINE_NOTICE = (
    "AI mentoring isn't available on this server right now, so this is an automatic "
    "summary rather than a generated answer."
)


class DeterministicProvider:
    """Keyword-matched curriculum from the Phase 3.2 topic library, and a
    blueprint derived from the project facts and its curriculum outline.

    No model and no network: the same request always yields the same output.
    It still returns serialised JSON so it travels the exact path a real
    model's output will (parse, validate, normalise, persist). Defaults it
    fills in are stated as assumptions, never as the user's choices.
    """

    name = "deterministic"
    model: str | None = None

    async def generate_curriculum(self, request: CurriculumRequest) -> str:
        topics = generate_project_topics(
            project_name=request.project_name,
            tech_stack=list(request.tech_stack),
            platforms=list(request.platforms),
            description=request.description,
        )
        return json.dumps({"schema_version": CURRICULUM_SCHEMA_VERSION, "topics": topics})

    async def generate_blueprint(self, request: BlueprintRequest) -> str:
        name = _clean(request.project_name)
        platforms = " and ".join(_PLATFORM_LABELS.get(p, p) for p in request.platforms) or "cross-platform"
        tech_stack, assumed = _tech_stack(request, name, platforms)
        return json.dumps(
            {
                "schema_version": BLUEPRINT_SCHEMA_VERSION,
                "summary": _summary(request, name, platforms, tech_stack),
                "assumptions": _assumptions(request, assumed),
                "tech_stack": tech_stack,
                "architecture": _architecture(request, name, tech_stack),
                "roadmap": _roadmap(request.curriculum, name, tech_stack),
            }
        )

    async def generate_mentor_reply(self, request: MentorRequest) -> str:
        """No model, so no generated advice: the reply says exactly that and
        repeats only the project facts it was given."""

        lines = [_MENTOR_OFFLINE_NOTICE]
        project = request.project
        if project is None:
            lines.append("Ask again once AI mentoring is enabled to get an answer to your question.")
        else:
            lines.append(f"Here is what I know about {_clean(project.name)}:")
            if project.description:
                lines.append(f"- Idea: {_clean(project.description)}")
            if project.tech_stack:
                lines.append(f"- Your tech stack: {', '.join(project.tech_stack)}")
            if project.blueprint:
                lines.append(f"- Blueprint: {project.blueprint.summary}")
                if project.blueprint.roadmap:
                    lines.append(f"- First roadmap phase: {project.blueprint.roadmap[0]}")
            if project.learning:
                done = len(project.learning.completed)
                total = done + len(project.learning.remaining)
                lines.append(f"- Learning: {done} of {total} topics completed")
                if project.learning.remaining:
                    lines.append(f"- Next topic: {project.learning.remaining[0]}")
            lines.extend(f"- {limitation}" for limitation in project.limitations)
        reply = "\n".join(lines)[:MAX_MENTOR_REPLY_LENGTH]
        return json.dumps({"schema_version": MENTOR_SCHEMA_VERSION, "reply": reply})


def _clean(text: str, limit: int | None = None) -> str:
    text = " ".join(text.split())
    if limit is None or len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def _category(technology: str) -> TechCategory:
    folded = technology.casefold()
    for category, keywords in _CATEGORY_KEYWORDS:
        if any(keyword in folded for keyword in keywords):
            return category
    return "other"


def _tech_stack(
    request: BlueprintRequest, name: str, platforms: str
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """The user's own stack first, then defaults for any core role it leaves
    open. Returns the stack and the defaults it kept."""

    mobile = any(platform in ("android", "ios") for platform in request.platforms)
    defaults = [_DEFAULTS["mobile" if mobile else "web"], _DEFAULTS["backend"], _DEFAULTS["database"]]

    chosen: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for technology in request.tech_stack:
        cleaned = _clean(technology, _NAME_LIMIT)
        category = _category(cleaned)
        key = (category, cleaned.casefold())
        if not cleaned or key in seen:
            continue
        seen.add(key)
        chosen.append(
            {
                "category": category,
                "name": cleaned,
                "purpose": _clean(_PURPOSES[category].format(name=name, platforms=platforms), _SHORT_LIMIT),
                "rationale": _clean(f"You chose {cleaned} for {name}; the blueprint builds on it.", _SHORT_LIMIT),
                # The user's own choice is never second-guessed with alternatives.
                "alternatives": [],
                "integration_notes": _USER_INTEGRATION_NOTES.get(category),
            }
        )

    covered = {choice["category"] for choice in chosen}
    assumed = [
        {
            **default,
            "purpose": _clean(_PURPOSES[default["category"]].format(name=name, platforms=platforms), _SHORT_LIMIT),
        }
        for default in defaults
        if default["category"] not in covered
    ]
    # Defaults are appended last, so the cap never drops the user's own choices first.
    stack = (chosen + assumed)[:_MAX_TECH_CHOICES]
    return stack, [choice for choice in assumed if choice in stack]


def _assumptions(request: BlueprintRequest, assumed: list[dict[str, Any]]) -> list[str]:
    assumptions: list[str] = []
    if assumed:
        roles = _join([choice["category"] for choice in assumed], "or")
        names = _join([choice["name"] for choice in assumed], "and")
        verb = "is" if len(assumed) == 1 else "are"
        assumptions.append(f"No {roles} was specified, so {names} {verb} assumed as mainstream defaults.")
    if not (request.description or "").strip():
        assumptions.append(
            "No description was given, so the blueprint is based on the project name, platforms "
            "and curriculum only."
        )
    return assumptions


def _join(items: list[str], conjunction: str) -> str:
    return items[0] if len(items) == 1 else f"{', '.join(items[:-1])} {conjunction} {items[-1]}"


def _first(tech_stack: list[dict[str, Any]], category: TechCategory) -> str | None:
    return next((choice["name"] for choice in tech_stack if choice["category"] == category), None)


def _summary(
    request: BlueprintRequest, name: str, platforms: str, tech_stack: list[dict[str, Any]]
) -> str:
    stack = ", ".join(choice["name"] for choice in tech_stack[:3])
    topics = request.curriculum
    roadmap = (
        f'Its roadmap applies the {len(topics)}-topic curriculum, from "{topics[0].title}" '
        f'to "{topics[-1].title}".'
        if topics
        else "Its roadmap runs from project setup to release."
    )
    return _clean(f"{name} is built for {platforms} with {stack}. {roadmap}", _DESCRIPTION_LIMIT)


def _architecture(
    request: BlueprintRequest, name: str, tech_stack: list[dict[str, Any]]
) -> dict[str, Any]:
    mobile = any(platform in ("android", "ios") for platform in request.platforms)
    web = "web" in request.platforms
    client_key, client_label = (
        ("client-app", "app") if mobile and web else
        ("mobile-app", "mobile app") if mobile else
        ("web-app", "web app")
    )
    backend = _first(tech_stack, "backend")
    database = _first(tech_stack, "database")
    auth = _first(tech_stack, "authentication")
    ai = _first(tech_stack, "ai")
    token = " carrying the session token" if auth else ""

    client_connections = [{"target": "api", "interaction": f"Sends HTTPS JSON requests{token}."}]
    if auth:
        client_connections.append(
            {"target": "auth-provider", "interaction": "Runs the sign-in flow and obtains the session token."}
        )
    api_connections = [
        {"target": "database", "interaction": "Reads and writes the records of each signed-in user."}
    ]
    if auth:
        api_connections.append(
            {"target": "auth-provider", "interaction": "Verifies the session token on each protected request."}
        )
    if ai:
        api_connections.append(
            {"target": "ai-provider", "interaction": "Sends prompts server-side with the secret key and validates the reply."}
        )

    components: list[dict[str, Any]] = [
        {
            "key": client_key,
            "name": _clean(f"{name} {client_label}", _NAME_LIMIT),
            "kind": "client",
            "responsibility": _clean(
                f"Presents the screens of {name} and sends every data request to the API.", _SHORT_LIMIT
            ),
            "connections": client_connections,
        },
        {
            "key": "api",
            "name": _clean(f"{name} API", _NAME_LIMIT),
            "kind": "service",
            "responsibility": _clean(
                f"{f'Built with {backend}: v' if backend else 'V'}alidates requests, checks ownership "
                f"and runs the business logic of {name}.",
                _SHORT_LIMIT,
            ),
            "connections": api_connections,
        },
        {
            "key": "database",
            "name": _clean(f"{name} database", _NAME_LIMIT),
            "kind": "datastore",
            "responsibility": _clean(
                f"Persists the records of {name}{f' in {database}' if database else ''}.", _SHORT_LIMIT
            ),
            "connections": [],
        },
    ]
    if auth:
        components.append(
            {
                "key": "auth-provider",
                "name": auth,
                "kind": "external",
                "responsibility": "Signs users in and issues the session tokens the API verifies.",
                "connections": [],
            }
        )
    if ai:
        components.append(
            {
                "key": "ai-provider",
                "name": ai,
                "kind": "external",
                "responsibility": _clean(f"Generates the AI output of {name} on request from the API.", _SHORT_LIMIT),
                "connections": [],
            }
        )

    steps: list[dict[str, str]] = []
    if auth:
        steps.append(
            {"actor": client_key, "target": "auth-provider", "action": "The user signs in and the app receives a session token."}
        )
    steps += [
        {"actor": client_key, "target": "api", "action": f"The app sends the user's request{token}."},
        {"actor": "api", "target": "database", "action": "The API validates the request and reads or writes the user's records."},
    ]
    if ai:
        steps.append(
            {"actor": "api", "target": "ai-provider", "action": "The API calls the AI provider and validates its response."}
        )
    steps.append({"actor": "api", "target": client_key, "action": "The API returns a typed response that the app renders."})

    failure_modes = [
        {
            "scenario": "The API is unreachable or the network drops.",
            "handling": "The app shows a recoverable error with a retry and keeps the user's unsent input.",
        },
        {
            "scenario": "A request carries invalid data.",
            "handling": "The API rejects it with a 422 before any write, and the app shows what to fix.",
        },
    ]
    if auth:
        failure_modes.append(
            {
                "scenario": "A session token is missing, expired or invalid.",
                "handling": "The API responds 401 and the app asks the user to sign in again.",
            }
        )
    if ai:
        failure_modes.append(
            {
                "scenario": "The AI provider is slow, fails or returns invalid output.",
                "handling": "The API times out or rejects it and returns a retryable error; nothing invalid is stored.",
            }
        )

    return {
        "style": "Layered client-server",
        "overview": _clean(
            f"The {client_label} of {name} talks only to the {backend or 'backend'} API, which owns "
            f"validation, ownership checks and business rules and is the only component that reads "
            f"or writes {database or 'the database'}."
            + (" AI calls stay on the server." if ai else ""),
            _DESCRIPTION_LIMIT,
        ),
        "components": components,
        "flows": [{"name": _clean(f"Use {name}", _TITLE_LIMIT), "steps": steps}],
        "failure_modes": failure_modes,
        "tradeoffs": [
            "One API service keeps deployment simple; parts that need to scale on their own "
            "would have to be split out later."
        ],
    }


def _roadmap(
    topics: tuple[CurriculumTopicSummary, ...], name: str, tech_stack: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Implementation phases that apply the curriculum in its order: its topics
    are split, in order, as evenly as possible across 2 to 4 phases, and each
    phase builds on the one before it."""

    ordered = sorted(topics, key=lambda topic: topic.order)
    phase_count = max(2, min(4, len(ordered)))
    size, extra = divmod(len(ordered), phase_count)
    categories = {choice["category"] for choice in tech_stack}

    phases: list[dict[str, Any]] = []
    start = 0
    for index, key in enumerate(_PHASE_PLANS[phase_count]):
        end = start + size + (1 if index < extra else 0)
        applied = ordered[start:end][:_MAX_PHASE_TOPICS]
        start = end
        plan = _PHASES[key]
        order = index + 1
        phases.append(
            {
                "order": order,
                "title": plan["title"],
                "goal": _clean(plan["goal"].format(name=name), _SHORT_LIMIT),
                "rationale": plan["rationale"],
                "tasks": [_clean(task.format(name=name), _SHORT_LIMIT) for task in plan["tasks"]],
                "deliverables": [_clean(item.format(name=name), _SHORT_LIMIT) for item in plan["deliverables"]],
                "acceptance_criteria": list(plan["acceptance_criteria"]),
                "depends_on": [] if order == 1 else [order - 1],
                "tech_categories": [category for category in plan["tech_categories"] if category in categories],
                "risks": list(plan["risks"]),
                "learning": [
                    {
                        "topic_order": topic.order,
                        "application": _clean(f"Use it in this phase: {topic.description}", _SHORT_LIMIT),
                    }
                    for topic in applied
                ],
            }
        )
    return phases
