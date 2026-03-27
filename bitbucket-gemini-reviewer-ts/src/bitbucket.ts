import axios, { type AxiosInstance } from "axios";
import type { BitbucketPullRequest } from "./types.js";
import { TokenManager } from "./utils/token-manager.js";
import logger from "./utils/logger.js";

let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getOAuthToken(): Promise<string> {
  const clientId = process.env.BITBUCKET_CLIENT_ID;
  const clientSecret = process.env.BITBUCKET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("BITBUCKET_CLIENT_ID and BITBUCKET_CLIENT_SECRET are required");
  }

  if (_cachedToken && Date.now() < _tokenExpiry) {
    return _cachedToken;
  }

  const response = await axios.post<{ access_token: string; expires_in?: number }>(
    "https://bitbucket.org/site/oauth2/access_token",
    new URLSearchParams({ 
      grant_type: "urn:bitbucket:oauth2:jwt",
      client_id: clientId,
      client_secret: clientSecret
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      timeout: 30000
    }
  );

  _cachedToken = response.data.access_token;
  _tokenExpiry = Date.now() + ((response.data.expires_in ?? 3600) - 60) * 1000;
  return _cachedToken;
}

async function createClient(): Promise<AxiosInstance> {
  const baseURL = process.env.BITBUCKET_BASE_URL ?? "https://api.bitbucket.org/2.0";
  
  // Use repository access token if available (simpler)
  const repoToken = process.env.BITBUCKET_TOKEN;
  if (repoToken) {
    logger.debug('Using repository access token for authentication');
    return axios.create({
      baseURL,
      timeout: 60000,
      headers: {
        Authorization: `Bearer ${repoToken}`,
        Accept: "application/json"
      }
    });
  }
  
  // Fall back to OAuth with secure token management
  logger.debug('Using OAuth authentication with secure token management');
  const tokenManager = TokenManager.getInstance();
  const token = await tokenManager.getValidToken();

  return axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
}

export async function getPullRequest(workspace: string, repoSlug: string, prId: number): Promise<BitbucketPullRequest> {
  const client = await createClient();
  const url = `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}`;
  
  logger.debug('Fetching PR details', { workspace, repoSlug, prId, url });
  
  try {
    const { data } = await client.get<BitbucketPullRequest>(url);
    logger.debug('Successfully fetched PR details', { 
      workspace, 
      repoSlug, 
      prId, 
      title: data.title 
    });
    return data;
  } catch (error) {
    logger.error('Failed to fetch PR details', {
      workspace,
      repoSlug,
      prId,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: (error as any).response?.status
    });
    throw error;
  }
}

export async function getPullRequestDiff(workspace: string, repoSlug: string, prId: number): Promise<string> {
  const client = await createClient();
  const url = `/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/diff`;
  
  logger.debug('Fetching PR diff', { workspace, repoSlug, prId, url });
  
  try {
    const { data } = await client.get<string>(url, {
      headers: {
        Accept: "text/plain"
      },
      responseType: "text"
    });

    const diffText = typeof data === "string" ? data : String(data);
    logger.debug('Successfully fetched PR diff', { 
      workspace, 
      repoSlug, 
      prId, 
      diffSize: diffText.length 
    });
    
    return diffText;
  } catch (error) {
    logger.error('Failed to fetch PR diff', {
      workspace,
      repoSlug,
      prId,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: (error as any).response?.status
    });
    throw error;
  }
}

export async function createPullRequestComment(
  workspace: string,
  repoSlug: string,
  prId: number,
  rawText: string
): Promise<unknown> {
  const client = await createClient();
  const payload = {
    content: {
      raw: rawText
    }
  };

  const { data } = await client.post(`/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`, payload, {
    headers: {
      "Content-Type": "application/json"
    }
  });

  return data;
}

export async function createInlinePullRequestComment(
  workspace: string,
  repoSlug: string,
  prId: number,
  rawText: string,
  filePath: string,
  line: number
): Promise<unknown> {
  const client = await createClient();
  const payload = {
    content: {
      raw: rawText
    },
    inline: {
      path: filePath,
      to: line
    }
  };

  const { data } = await client.post(`/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`, payload, {
    headers: {
      "Content-Type": "application/json"
    }
  });

  return data;
}

export async function createCommitStatus(
  workspace: string,
  repoSlug: string,
  commitHash: string,
  state: "SUCCESSFUL" | "FAILED" | "INPROGRESS" | "STOPPED",
  key: string,
  name: string,
  description: string,
  url?: string
): Promise<unknown> {
  const client = await createClient();
  const payload = { key, state, name, description, url };

  const { data } = await client.post(`/repositories/${workspace}/${repoSlug}/commit/${commitHash}/statuses/build`, payload, {
    headers: {
      "Content-Type": "application/json"
    }
  });

  return data;
}
