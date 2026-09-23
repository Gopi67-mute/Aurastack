"""Curriculum generation.

Python port of features/learning/constants/topicLibrary.ts and
features/learning/services/generateProjectTopics.ts, so a project created via
the API gets the same curriculum a locally-created mock project would have
gotten. Deterministic: same project in, same topic ids/order out, so
persisted progress keeps matching topic ids across requests.

V1 placeholder for AI-generated learning content, same as the frontend
original. Replace with real AI generation in a later phase; only this module
and its dict shape need to change, callers are unaffected.
"""

from collections.abc import Callable
from dataclasses import dataclass, field

MOBILE = ["react native", "expo", "android", "ios", "mobile"]
FRONTEND = [*MOBILE, "react", "web", "next"]


@dataclass(frozen=True)
class TopicLibraryEntry:
    id: str
    title: str
    keywords: tuple[str, ...]
    content: Callable[[str], dict[str, str | None]]
    always: bool = field(default=False)


def _architecture_planning(name: str) -> dict[str, str | None]:
    return {
        "what": "Deciding how the parts of an app (screens, API, database) fit together before writing code.",
        "why": f"{name} will grow feature by feature; a clear structure keeps each change small and safe.",
        "how": "Split the app into layers with one responsibility each, and let data flow in one direction between them.",
        "example": "Screens call services, services call the API, and only the API touches the database.",
        "apply": f"Sketch the main screens and data of {name} and note which layer owns each piece.",
        "miniTask": f"List the three core features of {name} and the data each one needs.",
    }


def _react_fundamentals(name: str) -> dict[str, str | None]:
    return {
        "what": "Building interfaces from components, props and state.",
        "why": f"Every screen of {name} is a tree of components, so this is the foundation for the whole UI.",
        "how": "Components return UI. Props flow down, state lives in hooks, and a state change re-renders what depends on it.",
        "example": "A ProjectCard component receives a project prop and renders its name and progress.",
        "apply": f"The screens of {name} are composed from small reusable typed components.",
        "miniTask": f"Build one reusable card component for the main item in {name}.",
    }


def _navigation_routing(name: str) -> dict[str, str | None]:
    return {
        "what": "Moving between screens and passing data such as ids through the URL.",
        "why": f"Users of {name} move between lists, details and forms, so navigation has to be predictable.",
        "how": "Each file maps to a route, brackets declare dynamic params, and layouts group screens into tabs or stacks.",
        "example": "A route like /items/[itemId] opens the detail screen for whichever id is in the URL.",
        "apply": f"{name} needs a list screen and a detail screen that reads its id from the route.",
        "miniTask": "Add a dynamic detail route and read its id param.",
    }


def _state_management(name: str) -> dict[str, str | None]:
    return {
        "what": "Sharing client state between screens without passing props through every level.",
        "why": f"Parts of {name} (like the current user or selection) are needed on several screens at once.",
        "how": "Keep shared state in a small store; components subscribe only to the slices they use.",
        "example": "A store exposes the selected item and an action to change it; the header reads just the name.",
        "apply": f"Keep shared UI state of {name} in a store, and treat the server as the source of truth for data.",
        "miniTask": "Move one piece of state used by two screens into a store.",
    }


def _node_express(name: str) -> dict[str, str | None]:
    return {
        "what": "Writing an HTTP server with routes and middleware in Node.js.",
        "why": f"{name} needs a backend to hold rules and data that the client should not own.",
        "how": "Routes receive requests, middleware handles cross-cutting work such as auth, and handlers return JSON.",
        "example": "A GET /items route reads items from the database and returns them as JSON.",
        "apply": f"Expose the core resources of {name} as small, focused routes.",
        "miniTask": "Create one GET route that returns a hardcoded list as JSON.",
    }


def _fastapi_async(name: str) -> dict[str, str | None]:
    return {
        "what": "Building async APIs in Python with typed request and response models.",
        "why": f"{name} needs a fast, validated backend, and FastAPI checks data at the edge for you.",
        "how": "Route functions declare typed parameters and models; async handlers keep the server responsive during I/O.",
        "example": "An async GET /items handler awaits the database and returns a validated response model.",
        "apply": f"Define request and response models for the main resources of {name}.",
        "miniTask": "Write one async endpoint with a Pydantic response model.",
    }


def _rest_api_design(name: str) -> dict[str, str | None]:
    return {
        "what": "Designing predictable HTTP endpoints around resources, methods and status codes.",
        "why": f"A consistent API makes {name} easier to build, test and extend.",
        "how": "Use nouns for resources, HTTP methods for actions, and proper status codes for outcomes.",
        "example": "GET /items lists, POST /items creates, PATCH /items/{id} updates, DELETE /items/{id} removes.",
        "apply": f"Map each core feature of {name} to a resource and its endpoints.",
        "miniTask": f"Write the endpoint list for the main resource of {name}.",
    }


def _mongodb_data_modeling(name: str) -> dict[str, str | None]:
    return {
        "what": "Structuring documents and collections so common reads are fast and simple.",
        "why": f"How {name} stores its data decides how easily it can query and grow.",
        "how": "Embed data that is read together, reference data that grows or is shared, and index the fields you query.",
        "example": "An order document embeds its line items but references the user by id.",
        "apply": f"Choose one collection per core resource of {name} and decide what to embed.",
        "miniTask": "Draft one document shape and mark the field you will query most.",
    }


def _authentication(name: str) -> dict[str, str | None]:
    return {
        "what": "Proving who a user is and limiting what they can access.",
        "why": f"{name} has user-specific data that must never be visible to anyone else.",
        "how": "A provider signs the user in and issues a token; the backend verifies it on every protected request.",
        "example": "The app sends a bearer token; the API rejects expired or invalid tokens with 401.",
        "apply": f"Verify the token on every {name} endpoint and check that the user owns the resource.",
        "miniTask": "List which endpoints must be protected and which can stay public.",
    }


def _testing_basics(name: str) -> dict[str, str | None]:
    return {
        "what": "Automated checks that confirm important behaviour keeps working.",
        "why": f"Tests let you change {name} without fear of silently breaking features.",
        "how": "Test pure logic with unit tests, and the critical user flows with a few integration tests.",
        "example": "A unit test checks that a progress percentage is computed correctly for edge cases.",
        "apply": f"Start with the business rules of {name} that would hurt most if they broke.",
        "miniTask": "Write one test for a pure function in your project.",
    }


def _deployment(name: str) -> dict[str, str | None]:
    return {
        "what": "Getting the app and its backend running for real users.",
        "why": f"{name} only creates value once people can use it.",
        "how": "Keep secrets in environment variables, build reproducibly, and use separate development and production setups.",
        "example": "The backend runs in a Docker image on a host; the app is built with separate dev and production profiles.",
        "apply": f"Plan how {name} will ship: where the backend runs and how the app is distributed.",
        "miniTask": "List every environment variable your project needs.",
    }


TOPIC_LIBRARY: tuple[TopicLibraryEntry, ...] = (
    TopicLibraryEntry(
        id="architecture-planning",
        title="Planning your architecture",
        always=True,
        keywords=(),
        content=_architecture_planning,
    ),
    TopicLibraryEntry(
        id="react-fundamentals",
        title="React fundamentals",
        keywords=tuple(FRONTEND),
        content=_react_fundamentals,
    ),
    TopicLibraryEntry(
        id="navigation-routing",
        title="Navigation and routing",
        keywords=(*MOBILE, "next", "react router"),
        content=_navigation_routing,
    ),
    TopicLibraryEntry(
        id="state-management",
        title="State management",
        keywords=(*MOBILE, "zustand", "redux"),
        content=_state_management,
    ),
    TopicLibraryEntry(
        id="node-express",
        title="Building a Node and Express server",
        keywords=("node", "express"),
        content=_node_express,
    ),
    TopicLibraryEntry(
        id="fastapi-async",
        title="FastAPI and async Python",
        keywords=("fastapi", "python"),
        content=_fastapi_async,
    ),
    TopicLibraryEntry(
        id="rest-api-design",
        title="REST API design",
        keywords=("api", "rest", "backend", "server", "node", "express", "fastapi"),
        content=_rest_api_design,
    ),
    TopicLibraryEntry(
        id="mongodb-data-modeling",
        title="MongoDB data modeling",
        keywords=("mongo", "database", "nosql"),
        content=_mongodb_data_modeling,
    ),
    TopicLibraryEntry(
        id="authentication",
        title="Authentication",
        keywords=("auth", "clerk", "jwt", "login", "sign in", "sign up", "account", "users"),
        content=_authentication,
    ),
    TopicLibraryEntry(
        id="testing-basics",
        title="Testing the essentials",
        always=True,
        keywords=(),
        content=_testing_basics,
    ),
    TopicLibraryEntry(
        id="deployment",
        title="Deployment",
        always=True,
        keywords=(),
        content=_deployment,
    ),
)


def _describe_project(
    tech_stack: list[str] | None, platforms: list[str] | None, description: str | None
) -> str:
    parts = [
        " ".join(tech_stack) if tech_stack else None,
        " ".join(platforms) if platforms else None,
        description,
    ]
    return " ".join(part for part in parts if part).lower()


def generate_project_topics(
    project_id: str,
    project_name: str,
    tech_stack: list[str] | None,
    platforms: list[str] | None,
    description: str | None,
) -> list[dict]:
    """Builds an ordered, not-yet-started curriculum from the project's stack,
    platforms and idea. Pure and deterministic: same inputs always produce the
    same topic ids and order.
    """

    haystack = _describe_project(tech_stack, platforms, description)

    matched = [
        entry
        for entry in TOPIC_LIBRARY
        if entry.always or any(keyword in haystack for keyword in entry.keywords)
    ]

    topics = []
    for index, entry in enumerate(matched):
        content = entry.content(project_name)
        topics.append(
            {
                "id": entry.id,
                "project_id": project_id,
                "title": entry.title,
                "description": content["what"],
                "order": index + 1,
                "content": content,
            }
        )
    return topics
