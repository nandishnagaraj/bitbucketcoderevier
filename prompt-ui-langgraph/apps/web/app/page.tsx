'use client';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

type ArtifactId =
  | 'prd'
  | 'prd_gap_review'
  | 'use_cases'
  | 'rtm'
  | 'architecture'
  | 'api_contract'
  | 'arch_risks'
  | 'user_stories'
  | 'implementation_plan'
  | 'code_skeleton'
  | 'test_plan'
  | 'coverage_gaps';

type RoleId = 'product_owner' | 'architect' | 'developer' | 'qa' | 'full' | 'custom';
type GitProvider = 'github' | 'bitbucket';

const ARTIFACT_OPTIONS: Array<{ id: ArtifactId; label: string }> = [
  { id: 'prd', label: 'PRD' },
  { id: 'use_cases', label: 'Use Cases' },
  { id: 'rtm', label: 'Traceability Matrix (RTM)' },
  { id: 'prd_gap_review', label: 'PRD Gap Review' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'api_contract', label: 'API Contract' },
  { id: 'arch_risks', label: 'Architecture Risk Review' },
  { id: 'user_stories', label: 'User Stories' },
  { id: 'implementation_plan', label: 'Implementation Plan' },
  { id: 'code_skeleton', label: 'Code Skeleton' },
  { id: 'test_plan', label: 'Test Plan' },
  { id: 'coverage_gaps', label: 'Coverage Gaps' },
];

const ROLE_PRESETS: Record<RoleId, ArtifactId[]> = {
  product_owner: ['prd', 'use_cases'],
  architect: ['prd', 'use_cases', 'architecture', 'api_contract', 'arch_risks'],
  developer: ['prd', 'use_cases', 'architecture', 'user_stories', 'implementation_plan', 'code_skeleton'],
  qa: ['prd', 'use_cases', 'architecture', 'user_stories', 'test_plan', 'coverage_gaps'],
  full: ARTIFACT_OPTIONS.map((x) => x.id),
  custom: ['prd', 'use_cases'],
};

const ARTIFACT_NODE: Record<ArtifactId, 'pm' | 'arch' | 'dev' | 'qa'> = {
  prd: 'pm',
  prd_gap_review: 'pm',
  use_cases: 'pm',
  rtm: 'pm',
  architecture: 'arch',
  api_contract: 'arch',
  arch_risks: 'arch',
  user_stories: 'dev',
  implementation_plan: 'dev',
  code_skeleton: 'dev',
  test_plan: 'qa',
  coverage_gaps: 'qa',
};

const NODE_DEPS: Record<'pm' | 'arch' | 'dev' | 'qa', Array<'pm' | 'arch' | 'dev' | 'qa'>> = {
  pm: [],
  arch: ['pm'],
  dev: ['arch'],
  qa: ['dev'],
};

const NODE_LABELS: Record<'pm' | 'arch' | 'dev' | 'qa', string> = {
  pm: 'PM',
  arch: 'Architect',
  dev: 'Developer',
  qa: 'QA',
};

const NODE_ORDER: Array<'pm' | 'arch' | 'dev' | 'qa'> = ['pm', 'arch', 'dev', 'qa'];

function getSessionId(): string {
  return window.localStorage.getItem('session_id') || '';
}

function getRequiredNodes(selectedArtifacts: ArtifactId[]): Array<'pm' | 'arch' | 'dev' | 'qa'> {
  const required = new Set<'pm' | 'arch' | 'dev' | 'qa'>(selectedArtifacts.map((a) => ARTIFACT_NODE[a]));

  let changed = true;
  while (changed) {
    changed = false;
    for (const node of Array.from(required)) {
      for (const dep of NODE_DEPS[node]) {
        if (!required.has(dep)) {
          required.add(dep);
          changed = true;
        }
      }
    }
  }

  return NODE_ORDER.filter((n) => required.has(n));
}

export default function HomePage() {
  const [gitProvider, setGitProvider] = useState<GitProvider>('github');
  const [authenticated, setAuthenticated] = useState(false);
  const [idea, setIdea] = useState('Build a leave management system');
  const [techStack, setTechStack] = useState('React, Node.js, PostgreSQL');
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [llmProvider, setLlmProvider] = useState<'azure' | 'gemini'>('azure');
  const [llmModel, setLlmModel] = useState('');
  const [role, setRole] = useState<RoleId>('product_owner');
  const [selectedArtifacts, setSelectedArtifacts] = useState<ArtifactId[]>(ROLE_PRESETS.product_owner);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requiredNodes = getRequiredNodes(selectedArtifacts);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('git_provider');
    const sessionId = params.get('session_id');
    const fromStorage = window.localStorage.getItem('git_provider');

    const next = (fromQuery || fromStorage || 'github').toLowerCase();
    if (next === 'github' || next === 'bitbucket') {
      setGitProvider(next as GitProvider);
      window.localStorage.setItem('git_provider', next);
    }

    if (sessionId) {
      window.localStorage.setItem('session_id', sessionId);
    }

    if (fromQuery || sessionId) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('git_provider', gitProvider);
  }, [gitProvider]);

  async function refreshMe() {
    const sid = getSessionId();
    const url = sid
      ? `${API}/me?provider=${gitProvider}&session_id=${encodeURIComponent(sid)}`
      : `${API}/me?provider=${gitProvider}`;
    const res = await fetch(url, {
      credentials: 'include',
    });
    const data = await res.json();
    setAuthenticated(Boolean(data.authenticated));
  }

  useEffect(() => { refreshMe().catch(() => {}); }, [gitProvider]);

  function setRolePreset(nextRole: RoleId) {
    setRole(nextRole);
    if (nextRole !== 'custom') {
      setSelectedArtifacts(ROLE_PRESETS[nextRole]);
    }
  }

  function toggleArtifact(artifact: ArtifactId, checked: boolean) {
    setRole('custom');
    setSelectedArtifacts((prev) => {
      if (checked && !prev.includes(artifact)) return [...prev, artifact];
      if (!checked) return prev.filter((x) => x !== artifact);
      return prev;
    });
  }

  async function run() {
    if (!authenticated) {
      setError(`Please sign in with ${gitProvider === 'github' ? 'GitHub' : 'Bitbucket'} before running the pipeline.`);
      return;
    }

    if (selectedArtifacts.length === 0) {
      setError('Select at least one artifact to generate.');
      return;
    }

    if (!repo.trim()) {
      setError('Enter a target repository URL before running.');
      return;
    }

    if (!repo.startsWith('https://')) {
      setError('Repository URL must start with https://');
      return;
    }

    setLoading(true); setError(null); setResult(null);
    try {
      const sid = getSessionId();
      const url = sid
        ? `${API}/runs?session_id=${encodeURIComponent(sid)}`
        : `${API}/runs`;
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea,
          tech_stack: techStack,
          repo_https_url: repo,
          branch,
          git_provider: gitProvider,
          llm_provider: llmProvider,
          llm_model: llmModel,
          max_loops: 2,
          dest_subdir: 'runs',
          role,
          selected_artifacts: selectedArtifacts,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Run failed');
      setResult(data);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
      refreshMe().catch(() => {});
    }
  }

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
      <h1 style={{ marginBottom: 6 }}>Prompt Template UI → LangGraph → Push to Git Provider</h1>
      <p style={{ marginTop: 0, color: '#444' }}>
        Login with GitHub or Bitbucket, generate SDLC markdown using LangGraph, and push a dated folder into the selected repo under <code>runs/</code>.
      </p>

      <div style={{ marginBottom: 16, maxWidth: 360 }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Git Provider</label>
        <select
          value={gitProvider}
          onChange={(e) => setGitProvider(e.target.value as GitProvider)}
          style={{ width: '100%' }}
        >
          <option value="github">GitHub</option>
          <option value="bitbucket">Bitbucket</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        {!authenticated ? (
          <a href={`${API}/auth/login?provider=${gitProvider}`} style={{ padding: '10px 14px', border: '1px solid #333', borderRadius: 8, textDecoration: 'none' }}>
            Sign in with {gitProvider === 'github' ? 'GitHub' : 'Bitbucket'}
          </a>
        ) : (
          <button
            onClick={async () => {
              const sid = getSessionId();
              const url = sid
                ? `${API}/auth/logout?session_id=${encodeURIComponent(sid)}`
                : `${API}/auth/logout`;
              await fetch(url, {
                method: 'POST',
                credentials: 'include',
              });
              window.localStorage.removeItem('session_id');
              await refreshMe();
            }}
            style={{ padding: '10px 14px', border: '1px solid #333', borderRadius: 8, background: 'white' }}
          >
            Logout
          </button>
        )}
        <span style={{ color: authenticated ? 'green' : '#a00' }}>
          {authenticated ? 'Authenticated' : 'Not authenticated'}
        </span>
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Run Inputs</h2>

          <label style={{ display: 'block', fontWeight: 600, marginTop: 8 }}>Idea</label>
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={4} style={{ width: '100%' }} />

          <label style={{ display: 'block', fontWeight: 600, marginTop: 8 }}>Tech Stack</label>
          <input value={techStack} onChange={(e) => setTechStack(e.target.value)} style={{ width: '100%' }} />

          <label style={{ display: 'block', fontWeight: 600, marginTop: 8 }}>Target Repo (HTTPS)</label>
          <input value={repo} onChange={(e) => setRepo(e.target.value)} style={{ width: '100%' }} />

          <label style={{ display: 'block', fontWeight: 600, marginTop: 8 }}>Branch</label>
          <input value={branch} onChange={(e) => setBranch(e.target.value)} style={{ width: '100%' }} />

          <label style={{ display: 'block', fontWeight: 600, marginTop: 8 }}>LLM Provider</label>
          <select
            value={llmProvider}
            onChange={(e) => {
              const next = e.target.value as 'azure' | 'gemini';
              setLlmProvider(next);
              if (!llmModel.trim()) {
                setLlmModel(next === 'azure' ? '' : 'gemini-2.5-flash');
              }
            }}
            style={{ width: '100%' }}
          >
            <option value="azure">Azure OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>

          <label style={{ display: 'block', fontWeight: 600, marginTop: 8 }}>Model (optional)</label>
          <input
            value={llmModel}
            onChange={(e) => setLlmModel(e.target.value)}
            placeholder={llmProvider === 'gemini' ? 'gemini-2.5-flash' : 'Uses AZURE_OPENAI_DEPLOYMENT'}
            style={{ width: '100%' }}
          />

          <label style={{ display: 'block', fontWeight: 600, marginTop: 8 }}>Role Preset</label>
          <select
            value={role}
            onChange={(e) => setRolePreset(e.target.value as RoleId)}
            style={{ width: '100%' }}
          >
            <option value="product_owner">Product Owner</option>
            <option value="architect">Architect</option>
            <option value="developer">Developer</option>
            <option value="qa">QA</option>
            <option value="full">Full SDLC</option>
            <option value="custom">Custom</option>
          </select>

          <label style={{ display: 'block', fontWeight: 600, marginTop: 8 }}>Artifacts To Generate</label>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 8, maxHeight: 220, overflowY: 'auto' }}>
            {ARTIFACT_OPTIONS.map((artifact) => (
              <label key={artifact.id} style={{ display: 'block', marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={selectedArtifacts.includes(artifact.id)}
                  onChange={(e) => toggleArtifact(artifact.id, e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                {artifact.label}
              </label>
            ))}
          </div>

          <label style={{ display: 'block', fontWeight: 600, marginTop: 8 }}>Chain Preview</label>
          <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 10, background: '#fafafa' }}>
            <p style={{ margin: '0 0 6px 0' }}>
              <b>Selected artifacts:</b> {selectedArtifacts.length ? selectedArtifacts.join(', ') : 'None'}
            </p>
            <p style={{ margin: '0 0 6px 0' }}>
              <b>LLM:</b> {llmProvider}{llmModel.trim() ? ` (${llmModel.trim()})` : ''}
            </p>
            <p style={{ margin: '0 0 6px 0' }}>
              <b>Git provider:</b> {gitProvider}
            </p>
            <p style={{ margin: 0 }}>
              <b>Required nodes:</b> {requiredNodes.map((n) => NODE_LABELS[n]).join(' -> ')}
            </p>
          </div>

          <button onClick={run} disabled={loading || !authenticated} style={{ marginTop: 12, padding: '10px 14px', border: '1px solid #333', borderRadius: 8, background: '#111', color: 'white', opacity: authenticated ? 1 : 0.6 }}>
            {loading ? 'Running…' : 'Generate + Push'}
          </button>

          {error && <p style={{ color: '#a00' }}><b>Error:</b> {error}</p>}
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Result</h2>
          {!result && <p style={{ color: '#555' }}>Run the pipeline to see commit SHA and generated files.</p>}
          {result && (
            <div>
              <p><b>Repo:</b> {result.repo}</p>
              <p><b>Branch:</b> {result.branch}</p>
              <p><b>Git provider:</b> {result.git_provider || gitProvider}</p>
              <p><b>Run folder:</b> <code>runs/{result.run_folder}</code></p>
              <p><b>Commit:</b> <code>{result.commit}</code></p>
              <p><b>Selected role:</b> {role}</p>
              <p><b>Files:</b></p>
              <ul>
                {result.files?.map((f: string) => <li key={f}><code>{f}</code></li>)}
              </ul>
            </div>
          )}
        </div>
      </section>

      <hr style={{ margin: '24px 0' }} />
      <p style={{ color: '#555' }}>
        Developed by <a href="https://github.com/nandishnagaraj/" target="_blank" rel="noreferrer">nandish</a>.
      </p>
    </main>
  );
}
