from __future__ import annotations

from typing import Dict, Any, List, Optional, Set
import re

from .state import OrchestratorState, Defect
from .io_utils import write_artifact
from .prompts import PromptLibrary


def _fill(template: str, mapping: Dict[str, str]) -> str:
    out = template
    for k, v in mapping.items():
        out = out.replace(k, v)
    return out


def _extract_defects(text: str) -> List[Defect]:
    # Lightweight heuristic: look for lines starting with [SEVERITY: ...]
    defects: List[Defect] = []
    pattern = re.compile(r"\[(?:SEVERITY|Severity):\s*(Critical|High|Medium|Low)\]\s*[-—]\s*(.*)")
    for line in text.splitlines():
        m = pattern.search(line)
        if m:
            defects.append({"severity": m.group(1), "title": m.group(2).strip(), "description": line.strip()})
    return defects


def _persist(name: str, selected: Optional[Set[str]]) -> bool:
    if selected is None:
        return True
    return name in selected


def _has_heading(markdown: str, heading: str) -> bool:
    escaped = re.escape(heading)
    patterns = [
        rf"(?im)^\s{{0,3}}#{{1,6}}\s*{escaped}\s*$",
        rf"(?im)^\s*{escaped}\s*$",
        rf"(?im)^\s*{escaped}\s*:\s*$",
    ]
    return any(re.search(p, markdown) for p in patterns)


def _missing_sections(markdown: str, required_sections: List[str]) -> List[str]:
    return [s for s in required_sections if not _has_heading(markdown, s)]


def _enforce_sections(
    *,
    llm: Any,
    artifact_name: str,
    markdown: str,
    required_sections: List[str],
    context: str = "",
) -> str:
    missing = _missing_sections(markdown, required_sections)
    if not missing:
        return markdown

    repair_prompt = (
        f"Rewrite the following markdown for '{artifact_name}' to include all required headings exactly as listed.\n"
        f"Required headings: {', '.join(required_sections)}\n"
        "Rules:\n"
        "1) Keep technical meaning intact.\n"
        "2) Do not remove existing useful content.\n"
        "3) Add missing sections with concrete details.\n"
        "4) Return markdown only.\n"
    )
    if context:
        repair_prompt += f"\nAdditional context:\n{context}\n"
    repair_prompt += f"\nOriginal markdown:\n{markdown}"

    repaired = llm.invoke(repair_prompt)
    missing_after_repair = _missing_sections(repaired, required_sections)
    if missing_after_repair:
        raise ValueError(
            f"{artifact_name} failed validation; missing sections: {', '.join(missing_after_repair)}"
        )
    return repaired


def pm_node(
    state: OrchestratorState,
    *,
    llm: Any,
    prompts: PromptLibrary,
    selected_artifacts: Optional[Set[str]] = None,
) -> OrchestratorState:
    run_dir = state.get("run_dir") or "runs"

    # PRD is always generated — it feeds all downstream PM sub-artifacts and arch/dev/qa nodes
    prd_prompt = _fill(
        prompts.prd_full(),
        {
            "[PRODUCT NAME]": "(derive from idea)",
            "[1-2 SENTENCE PROBLEM STATEMENT]": state["idea"],
            "[PERSONAS]": "(to be defined)",
            "[GOAL]": "(to be defined)",
            "[STACK]": state.get("tech_stack", "(not specified)"),
        },
    )
    prd = llm.invoke(prd_prompt)
    prd = _enforce_sections(
        llm=llm,
        artifact_name="PRD",
        markdown=prd,
        required_sections=["Executive Summary", "Requirements", "Assumptions", "Open Questions", "Traceability"],
        context=state.get("idea", ""),
    )
    if _persist("prd", selected_artifacts):
        write_artifact(run_dir, "01_prd.md", prd)

    # Only generate + validate each sub-artifact when it is actually selected
    gap_review = ""
    if _persist("prd_gap_review", selected_artifacts):
        gap_prompt = prompts.prd_gap().replace("[PASTE PRD HERE]", prd)
        gap_review = llm.invoke(gap_prompt)
        gap_review = _enforce_sections(
            llm=llm,
            artifact_name="PRD Gap Review",
            markdown=gap_review,
            required_sections=["Gaps", "Recommendations", "Open Questions"],
        )
        write_artifact(run_dir, "02_prd_gap_review.md", gap_review)

    use_cases = ""
    if _persist("use_cases", selected_artifacts):
        use_case_prompt = (
            "Generate a concise markdown use-case document from this PRD. "
            "Include actors, preconditions, main flow, alternate flows, and postconditions.\n\n"
            f"PRD:\n{prd}"
        )
        use_cases = llm.invoke(use_case_prompt)
        use_cases = _enforce_sections(
            llm=llm,
            artifact_name="Use Cases",
            markdown=use_cases,
            required_sections=["Actors", "Preconditions", "Main Flow", "Alternate Flows", "Postconditions"],
        )
        write_artifact(run_dir, "03_use_cases.md", use_cases)

    rtm = ""
    if _persist("rtm", selected_artifacts):
        rtm_prompt = prompts.prd_rtm().replace("[PASTE PRD]", prd)
        rtm = llm.invoke(rtm_prompt)
        rtm = _enforce_sections(
            llm=llm,
            artifact_name="RTM",
            markdown=rtm,
            required_sections=["Traceability Matrix"],
        )
        write_artifact(run_dir, "04_rtm.md", rtm)

    return {**state, "prd": prd, "use_cases": use_cases, "rtm": rtm, "pm_open_questions": []}


def architect_node(
    state: OrchestratorState,
    *,
    llm: Any,
    prompts: PromptLibrary,
    selected_artifacts: Optional[Set[str]] = None,
) -> OrchestratorState:
    run_dir = state.get("run_dir") or "runs"
    prd = state.get("prd", "")

    # Architecture is always generated — it feeds api_contract, arch_risks, and downstream dev/qa nodes
    arch_prompt = prompts.architecture_design().replace("[PASTE KEY NFRs AND FUNCTIONAL REQUIREMENTS]", prd)
    architecture = llm.invoke(arch_prompt)
    architecture = _enforce_sections(
        llm=llm,
        artifact_name="Architecture",
        markdown=architecture,
        required_sections=["Executive Summary", "Architecture", "Decisions", "Risks", "Handoff"],
    )
    if _persist("architecture", selected_artifacts):
        write_artifact(run_dir, "05_architecture.md", architecture)

    api_contract = ""
    if _persist("api_contract", selected_artifacts):
        api_prompt = (prompts.openapi_contract()
            .replace("[FEATURE DESCRIPTION]", state.get("idea", ""))
            .replace("[PASTE RELEVANT SCHEMA]", "(derive from PRD)")
            .replace("[WHO CALLS THIS API — frontend, mobile, third parties]", "(derive from PRD)"))
        api_contract = llm.invoke(api_prompt)
        api_contract = _enforce_sections(
            llm=llm,
            artifact_name="API Contract",
            markdown=api_contract,
            required_sections=["Endpoints", "Schemas", "Error Handling"],
        )
        write_artifact(run_dir, "06_openapi.md", api_contract)

    arch_risks = ""
    if _persist("arch_risks", selected_artifacts):
        risk_prompt = prompts.arch_risk_review().replace("[PASTE DESIGN DOCUMENT OR DIAGRAM]", architecture)
        arch_risks = llm.invoke(risk_prompt)
        arch_risks = _enforce_sections(
            llm=llm,
            artifact_name="Architecture Risk Review",
            markdown=arch_risks,
            required_sections=["Risk Register", "Mitigations", "Open Questions"],
        )
        write_artifact(run_dir, "07_arch_risk_review.md", arch_risks)

    return {**state, "architecture": architecture, "api_contract": api_contract, "arch_risks": arch_risks, "adrs": "(see architecture output)"}


def developer_node(
    state: OrchestratorState,
    *,
    llm: Any,
    prompts: PromptLibrary,
    selected_artifacts: Optional[Set[str]] = None,
) -> OrchestratorState:
    run_dir = state.get("run_dir") or "runs"
    prd = state.get("prd", "")

    user_stories = ""
    if _persist("user_stories", selected_artifacts):
        stories_prompt = prompts.stories_from_prd().replace("[PASTE RELEVANT PRD SECTION]", prd)
        user_stories = llm.invoke(stories_prompt)
        user_stories = _enforce_sections(
            llm=llm,
            artifact_name="User Stories",
            markdown=user_stories,
            required_sections=["User Stories", "Acceptance Criteria", "Traceability"],
        )
        write_artifact(run_dir, "08_user_stories.md", user_stories)

    implementation_plan = ""
    if _persist("implementation_plan", selected_artifacts):
        impl_prompt = (prompts.dev_implementation()
            .replace("[LANGUAGE]", "(project language)")
            .replace("[FRAMEWORK]", state.get("tech_stack", "(stack)"))
            .replace("[PASTE RELATED FILES / INTERFACES]", "(none provided)")
            .replace("[PASTE RELEVANT SCHEMA]", "(derive from PRD/OpenAPI)")
            .replace("[FEATURE]", state.get("idea", ""))
            .replace("[US-###]", "US-001"))
        implementation_plan = llm.invoke(impl_prompt)
        implementation_plan = _enforce_sections(
            llm=llm,
            artifact_name="Implementation Plan",
            markdown=implementation_plan,
            required_sections=["Implementation Plan", "Dependencies", "Definition of Done"],
        )
        write_artifact(run_dir, "09_implementation_plan.md", implementation_plan)

    code_skeleton = "# Code Skeleton\n\n(Generated code would be placed here when connected to a repo/tooling.)\n"
    if _persist("code_skeleton", selected_artifacts):
        write_artifact(run_dir, "10_code_skeleton.md", code_skeleton)

    return {**state, "user_stories": user_stories, "implementation_plan": implementation_plan, "code_skeleton": code_skeleton}


def qa_node(
    state: OrchestratorState,
    *,
    llm: Any,
    prompts: PromptLibrary,
    selected_artifacts: Optional[Set[str]] = None,
) -> OrchestratorState:
    run_dir = state.get("run_dir") or "runs"
    code = state.get("code_skeleton", "")
    stories = state.get("user_stories", "")
    api = state.get("api_contract", "")

    # test_plan bundles: unit + integration + security + coverage_gaps
    # Only generate each component when test_plan or coverage_gaps is selected
    need_test_plan = _persist("test_plan", selected_artifacts)
    need_coverage = _persist("coverage_gaps", selected_artifacts)

    unit_tests = ""
    if need_test_plan:
        unit_prompt = (prompts.test_plan_unit()
            .replace("[PASTE FUNCTION OR CLASS]", code)
            .replace("[LANGUAGE]", "(language)")
            .replace("[JEST / PYTEST / JUNIT / etc.]", "(test framework)")
            .replace("[JEST MOCKS / MOCKITO / UNITTEST.MOCK / etc.]", "(mocking)")
            .replace("[PASTE INTERFACES OR SIGNATURES]", "(derive from code)"))
        unit_tests = llm.invoke(unit_prompt)
        unit_tests = _enforce_sections(
            llm=llm,
            artifact_name="Unit Tests",
            markdown=unit_tests,
            required_sections=["Test Cases", "Expected Results"],
        )

    integration_tests = ""
    if need_test_plan:
        int_prompt = (prompts.test_plan_integration()
            .replace("[METHOD]", "(method)")
            .replace("[PATH]", "(path)")
            .replace("[PASTE OPENAPI SPEC SECTION]", api or "(no api)")
            .replace("[DB TYPE AND RELEVANT TABLES]", "(db)")
            .replace("[AUTH MECHANISM]", "(auth)")
            .replace("[SUPERTEST / PYTEST / POSTMAN / etc.]", "(framework)"))
        integration_tests = llm.invoke(int_prompt)
        integration_tests = _enforce_sections(
            llm=llm,
            artifact_name="Integration Tests",
            markdown=integration_tests,
            required_sections=["Test Cases", "Expected Results"],
        )

    security_tests = ""
    if need_test_plan:
        sec_prompt = (prompts.test_security()
            .replace("[FEATURE DESCRIPTION]", state.get("idea", ""))
            .replace("[LIST ENDPOINTS]", "(derive from OpenAPI)")
            .replace("[JWT / OAuth / Session]", "(auth)")
            .replace("[PII / Financial / Public]", "(classify data)"))
        security_tests = llm.invoke(sec_prompt)
        security_tests = _enforce_sections(
            llm=llm,
            artifact_name="Security Tests",
            markdown=security_tests,
            required_sections=["Threats", "Test Cases", "Expected Results"],
        )

    coverage_gaps = ""
    if need_test_plan or need_coverage:
        coverage_prompt = (prompts.test_coverage_gaps()
            .replace("[PASTE SOURCE FILE]", code)
            .replace("[PASTE TEST FILE]", unit_tests)
            .replace("[PASTE COVERAGE OUTPUT]", "(not available)"))
        coverage_gaps = llm.invoke(coverage_prompt)
        coverage_gaps = _enforce_sections(
            llm=llm,
            artifact_name="Coverage Gaps",
            markdown=coverage_gaps,
            required_sections=["Coverage Gaps", "Recommendations", "Open Questions"],
        )

    defects = _extract_defects(coverage_gaps) if coverage_gaps else []

    test_plan = "\n\n".join(filter(None, [
        ("# Unit Tests\n" + unit_tests) if unit_tests else "",
        ("# Integration Tests\n" + integration_tests) if integration_tests else "",
        ("# Security Tests\n" + security_tests) if security_tests else "",
        ("# Coverage Gaps\n" + coverage_gaps) if coverage_gaps else "",
    ]))

    if need_test_plan and test_plan:
        write_artifact(run_dir, "11_test_plan.md", test_plan)
    if need_coverage and coverage_gaps:
        write_artifact(run_dir, "12_coverage_gaps.md", coverage_gaps)

    return {**state, "test_plan": test_plan, "defect_list": defects, "coverage_map": "(REQ/US → tests mapping TBD)"}
