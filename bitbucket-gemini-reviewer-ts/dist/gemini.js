import axios from "axios";
export async function reviewWithGemini({ prompt }) {
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4";
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION ?? "2024-12-01-preview";
    if (!apiKey || !endpoint) {
        throw new Error("AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT are required");
    }
    const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${apiVersion}`;
    const response = await axios.post(url, {
        messages: [
            {
                role: "system",
                content: "You are a senior code reviewer. Return ONLY valid JSON with a top-level object containing: summary (object with verdict, headline, overview) and findings (array). Each finding must have: severity (blocker|warning|suggestion), category, filePath, line, title, detail, confidence."
            },
            { role: "user", content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
    }, {
        headers: {
            "Content-Type": "application/json",
            "api-key": apiKey
        },
        timeout: 90000
    });
    const text = response.data.choices?.[0]?.message?.content ?? "";
    if (!text) {
        throw new Error("Azure OpenAI returned no content");
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    }
    catch {
        throw new Error(`Azure OpenAI did not return valid JSON: ${text.slice(0, 500)}`);
    }
    validateReviewResponse(parsed);
    return parsed;
}
function validateReviewResponse(value) {
    if (typeof value !== "object" || value === null) {
        throw new Error("Review response shape invalid: root must be an object");
    }
    const candidate = value;
    if (!candidate.summary || !Array.isArray(candidate.findings)) {
        throw new Error("Review response shape invalid: summary/findings missing");
    }
}
