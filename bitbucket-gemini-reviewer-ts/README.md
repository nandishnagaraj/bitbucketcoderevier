# Bitbucket Cloud AI PR Reviewer (TypeScript)

A comprehensive TypeScript service that provides automated code reviews for Bitbucket Cloud pull requests using AI (Azure OpenAI/Gemini). This service listens to Bitbucket webhook events, analyzes code changes, and posts intelligent review comments back to your PRs.

## 🎯 What It Does

- **Webhook Integration**: Receives Bitbucket Cloud webhook events for PR creation and updates
- **Code Analysis**: Fetches PR metadata and unified diff from Bitbucket Cloud
- **AI-Powered Review**: Sends the diff to AI with a structured JSON review prompt
- **Smart Comments**: Posts summary comments and optional inline comments for specific findings
- **Build Status**: Optionally posts build status on PR source commit
- **Deduplication**: Prevents duplicate comments using intelligent fingerprinting

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Bitbucket     │    │   Express App    │    │   Azure OpenAI  │
│   Webhook       │───▶│   (index.ts)    │───▶│   (gemini.ts)   │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │  Bitbucket API   │    │  Prompt Builder │
                       │  (bitbucket.ts) │    │  (prompt.ts)    │
                       └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Deduplication  │
                       │  (dedupe.ts)    │
                       └──────────────────┘
```

## 📁 Project Structure

```text
bitbucket-gemini-reviewer-ts/
├── src/
│   ├── index.ts              # Main Express server and webhook handler
│   ├── bitbucket.ts          # Bitbucket API client and authentication
│   ├── gemini.ts             # Azure OpenAI integration for code review
│   ├── prompt.ts             # Review prompt builder
│   ├── dedupe.ts             # Finding deduplication logic
│   ├── types.ts              # TypeScript type definitions
│   └── utils/                # Security and logging utilities
│       ├── logger.ts         # Winston structured logging
│       ├── validation.ts     # Input validation and sanitization
│       └── token-manager.ts  # Secure token management
├── nginx/                    # Nginx configuration for Docker
│   └── nginx.conf            # Reverse proxy configuration
├── logs/                     # Log files directory (created at runtime)
├── .env.example              # Environment variable template
├── .env.docker               # Docker environment template
├── docker-compose.yml        # Docker Compose orchestration
├── Dockerfile                # Container configuration
├── .dockerignore             # Docker build exclusions
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── README.md                 # This file
├── Instructions.md           # Code review guidelines
├── SECURITY_IMPROVEMENTS.md  # Security documentation
└── DOCKER_DEPLOYMENT.md      # Docker deployment guide
```

## 🔧 Code Explanation

### 1. **Main Server (`src/index.ts`)**

The heart of the application that handles webhook events and orchestrates the review process.

**Key Components:**

- **Express Server**: HTTP server with webhook endpoint
- **Webhook Verification**: Validates webhook signatures for security
- **Event Filtering**: Processes only PR-related events
- **Review Orchestration**: Coordinates the entire review workflow

**Core Functions:**

```typescript
// Webhook endpoint handler
app.post("/webhook/bitbucket", async (req, res) => {
  // 1. Verify webhook signature
  // 2. Filter PR events
  // 3. Extract repository info
  // 4. Run review process
  // 5. Return response
});

// Main review workflow
async function runReview(input) {
  // 1. Fetch PR details and diff
  // 2. Build AI prompt
  // 3. Get AI review
  // 4. Deduplicate findings
  // 5. Post comments back to PR
}
```

### 2. **Bitbucket API Client (`src/bitbucket.ts`)**

Handles all interactions with the Bitbucket Cloud API.

**Authentication Strategy:**
- **Primary**: Repository Access Token (simpler, recommended)
- **Fallback**: OAuth 2.0 with JWT flow

**API Functions:**

```typescript
// Get PR details
getPullRequest(workspace, repoSlug, prId)

// Get unified diff
getPullRequestDiff(workspace, repoSlug, prId)

// Post summary comment
createPullRequestComment(workspace, repoSlug, prId, content)

// Post inline comment
createInlinePullRequestComment(workspace, repoSlug, prId, content, filePath, line)

// Update build status
createCommitStatus(workspace, repoSlug, commitHash, state, key, name, description)
```

### 3. **AI Integration (`src/gemini.ts`)**

Communicates with Azure OpenAI for code analysis.

**Features:**
- **Structured Output**: Enforces JSON response format
- **System Prompt**: Sets AI behavior as senior code reviewer
- **Error Handling**: Validates response structure
- **Timeout Protection**: 90-second timeout for AI responses

**Request Structure:**
```typescript
{
  messages: [
    { role: "system", content: "You are a senior code reviewer..." },
    { role: "user", content: prompt }
  ],
  temperature: 0.1,
  response_format: { type: "json_object" }
}
```

### 4. **Prompt Builder (`src/prompt.ts`)**

Creates structured prompts for consistent AI responses.

**Prompt Structure:**
```typescript
{
  "summary": {
    "verdict": "pass" | "warn" | "fail",
    "headline": "short headline",
    "overview": "short paragraph"
  },
  "findings": [
    {
      "severity": "blocker" | "warning" | "suggestion",
      "category": "security" | "correctness" | "maintainability" | "tests" | "api",
      "title": "short title",
      "detail": "clear actionable explanation",
      "filePath": "relative/path/to/file",
      "line": 123,
      "confidence": 0.0
    }
  ]
}
```

### 5. **Deduplication (`src/dedupe.ts`)**

Prevents duplicate comments across multiple webhook triggers.

**Strategy:**
- **Fingerprinting**: Creates unique keys from finding properties
- **Filtering**: Removes findings without required fields
- **Sorting**: Orders by severity (blocker → warning → suggestion)

**Fingerprint Format:**
```typescript
`${severity}|${category}|${title}|${filePath}|${line}`
```

### 6. **Type Definitions (`src/types.ts`)**

Comprehensive TypeScript interfaces for type safety.

**Key Types:**
- `BitbucketWebhookPayload`: Webhook event structure
- `ReviewResponse`: AI review response format
- `ReviewFinding`: Individual issue finding
- `ReviewSummary`: Overall review summary

## 🚀 Step-by-Step Setup Guide

### Prerequisites

- **Node.js 20+** - JavaScript runtime
- **Bitbucket Cloud Repository** - Target repository for reviews
- **Azure OpenAI Access** - AI service for code analysis
- **Public HTTPS URL** - For webhook delivery (ngrok for testing)

### Step 1: Repository Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd bitbucket-gemini-reviewer-ts
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

### Step 2: Azure OpenAI Configuration

1. **Create Azure OpenAI Resource**:
   - Go to Azure Portal
   - Create "Azure OpenAI" resource
   - Deploy GPT-4 model

2. **Get API Credentials**:
   - API Key: From "Keys and Endpoint" section
   - Endpoint: Resource URL
   - Deployment: Model deployment name

### Step 3: Bitbucket Authentication

**Option A: Repository Access Token (Recommended)**

1. **Navigate to Repository**:
   ```
   https://bitbucket.org/<workspace>/<repo>/admin/access_tokens
   ```

2. **Create Token**:
   - Click "Create repository access token"
   - Name: "AI Review Bot"
   - Permissions:
     - Pull Request: Read, Write
     - Repository: Read
   - Copy the generated token

**Option B: OAuth App (Advanced)**

1. **Create OAuth Consumer**:
   ```
   https://bitbucket.org/<workspace>/settings/integrations
   ```
   - Add OAuth consumer
   - Set callback URL
   - Note client ID and secret

### Step 4: Environment Configuration

1. **Copy environment template**:
   ```bash
   cp .env.example .env
   ```

2. **Configure environment variables**:

   ```bash
   # Server Configuration
   PORT=3001

   # Bitbucket Authentication (Choose ONE)
   # Option A: Repository Access Token (Recommended)
   BITBUCKET_TOKEN=your_repository_token_here
   
   # Option B: OAuth (Alternative)
   BITBUCKET_CLIENT_ID=your_client_id
   BITBUCKET_CLIENT_SECRET=your_client_secret
   BITBUCKET_REDIRECT_URI=http://localhost:8000/auth/bitbucket/callback

   # Bitbucket API
   BITBUCKET_BASE_URL=https://api.bitbucket.org/2.0
   BITBUCKET_WEBHOOK_SECRET=  # Leave empty for no signature verification

   # Azure OpenAI Configuration
   AZURE_OPENAI_API_KEY=your_azure_api_key
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
   AZURE_OPENAI_DEPLOYMENT=gpt-4
   AZURE_OPENAI_API_VERSION=2024-12-01-preview

   # Behavior Configuration
   MAX_DIFF_CHARS=120000
   POST_INLINE_COMMENTS=false
   POST_SUMMARY_COMMENT=true
   POST_BUILD_STATUS=false
   BOT_TAG=ai-review-bot
   MIN_INLINE_CONFIDENCE=0.8
   ```

### Step 5: Ngrok Setup (for Webhook Testing)

1. **Install ngrok** (if not already installed):
   ```bash
   # macOS with Homebrew
   brew install ngrok
   
   # Or download from https://ngrok.com/download
   ```

2. **Start ngrok tunnel**:
   ```bash
   # Basic setup
   ngrok http 3001
   
   # With custom domain (paid plan)
   ngrok http 3001 --domain=your-custom-domain.ngrok.io
   
   # With authentication
   ngrok http 3001 --auth="username:password"
   ```

3. **Get your webhook URL**:
   - Look for the `Forwarding` line in ngrok output
   - Example: `https://abcd-1234-5678.ngrok-free.dev -> http://localhost:3001`
   - Your webhook URL: `https://abcd-1234-5678.ngrok-free.dev/webhook/bitbucket`

4. **Check ngrok status**:
   ```bash
   # View current tunnels
   curl http://127.0.0.1:4040/api/tunnels
   
   # Get just the URL
   curl http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[0].public_url'
   ```

5. **Stop ngrok**:
   ```bash
   # Stop all tunnels
   ngrok kill
   
   # Or press Ctrl+C in the ngrok terminal
   ```

### Step 6: Local Development Setup

1. **Start the development server**:
   ```bash
   npm run dev
   ```
   Server will start on port 3001

2. **Verify health endpoint**:
   ```bash
   curl http://localhost:3001/health
   # Response: {"ok":true}
   ```

3. **Set up tunnel for webhooks** (ngrok example):
   ```bash
   ngrok http 3001
   ```
   Copy the HTTPS URL for webhook configuration

### Step 7: Bitbucket Webhook Configuration

1. **Navigate to Webhook Settings**:
   ```
   https://bitbucket.org/<workspace>/<repo>/admin/webhooks
   ```

2. **Create Webhook**:
   - Title: "AI Review Bot"
   - URL: `https://your-ngrok-url.ngrok-free.dev/webhook/bitbucket`
     (Replace with your actual ngrok URL from Step 5)
   - Triggers:
     - ✅ Pull request created
     - ✅ Pull request updated
   - Secret: Leave empty (unless BITBUCKET_WEBHOOK_SECRET is set)

3. **Save and Test**:
   - Create a test PR
   - Check webhook delivery logs
   - Verify AI comments appear

### Step 8: Docker Deployment (Recommended for Production)

#### **Option A: Quick Docker Setup**

1. **Prepare Environment**:
   ```bash
   # Copy the production environment template
   cp .env.docker .env
   
   # Edit with your credentials
   nano .env
   ```

2. **Start with Docker Compose**:
   ```bash
   # Basic deployment
   docker-compose up -d
   
   # With Nginx reverse proxy (for HTTPS)
   docker-compose --profile with-nginx up -d
   
   # With Redis cache (for performance)
   docker-compose --profile with-redis up -d
   
   # Full production setup
   docker-compose --profile with-nginx --profile with-redis up -d
   ```

3. **Verify Deployment**:
   ```bash
   # Check service status
   docker-compose ps
   
   # Check logs
   docker-compose logs -f ai-reviewer
   
   # Test health endpoint
   curl http://localhost:3001/health
   ```

#### **Option B: Manual Docker Build**

1. **Build the Image**:
   ```bash
   docker build -t bitbucket-ai-reviewer .
   ```

2. **Run the Container**:
   ```bash
   docker run -d \
     --name ai-reviewer \
     -p 3001:3001 \
     --env-file .env \
     -v $(pwd)/logs:/app/logs \
     bitbucket-ai-reviewer
   ```

#### **Docker Features:**
- ✅ **Security**: Non-root user, minimal Alpine base
- ✅ **Health Checks**: Built-in container health monitoring
- ✅ **Resource Limits**: Memory and CPU constraints
- ✅ **Logging**: Persistent log volume mounting
- ✅ **Environment Isolation**: Secure configuration management
- ✅ **Scalable**: Easy horizontal scaling with Docker Compose

#### **Docker Files Overview:**
- `docker-compose.yml`: Multi-service orchestration
- `Dockerfile`: Production-ready container configuration
- `.dockerignore`: Optimized build exclusions
- `nginx/nginx.conf`: Reverse proxy configuration
- `.env.docker`: Production environment template

#### **For detailed Docker instructions**, see: [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)

### Step 9: Traditional Production Deployment

**For non-Docker deployments:**

1. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

2. **Environment Security**:
   - Use environment variables for secrets
   - Enable HTTPS
   - Set up proper webhook secrets
   - Configure rate limiting

3. **Process Management**:
   - Use PM2 or similar process manager
   - Set up log rotation
   - Configure monitoring and alerts

## 🔍 How It Works: Step-by-Step Flow

### Webhook Processing Flow

1. **Event Reception**:
   ```
   Bitbucket → Webhook → Express Server
   ```

2. **Security Verification**:
   ```
   Verify webhook signature (if configured)
   ```

3. **Event Filtering**:
   ```
   Check if event is "pullrequest:created" or "pullrequest:updated"
   ```

4. **Data Extraction**:
   ```
   Parse workspace, repository, and PR ID from webhook payload
   ```

### Review Processing Flow

1. **Fetch PR Data**:
   ```typescript
   const pr = await getPullRequest(workspace, repoSlug, prId);
   const diff = await getPullRequestDiff(workspace, repoSlug, prId);
   ```

2. **Prepare AI Prompt**:
   ```typescript
   const prompt = buildReviewPrompt({
     pr: { title: pr.title, description: pr.description },
     diffText: truncateDiff(diff)
   });
   ```

3. **Get AI Analysis**:
   ```typescript
   const review = await reviewWithGemini({ prompt });
   ```

4. **Process Results**:
   ```typescript
   review.findings = dedupeFindings(review.findings);
   ```

5. **Post Comments**:
   ```typescript
   // Summary comment
   await createPullRequestComment(workspace, repoSlug, prId, summary);
   
   // Inline comments (if enabled)
   for (const finding of highConfidenceFindings) {
     await createInlinePullRequestComment(...);
   }
   
   // Build status (if enabled)
   await createCommitStatus(...);
   ```

## 🎛️ Configuration Options

### Behavior Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `POST_SUMMARY_COMMENT` | `true` | Post overall review summary |
| `POST_INLINE_COMMENTS` | `false` | Post line-specific comments |
| `POST_BUILD_STATUS` | `false` | Update commit build status |
| `MIN_INLINE_CONFIDENCE` | `0.8` | Minimum confidence for inline comments |

### Limits and Thresholds

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_DIFF_CHARS` | `120000` | Maximum diff size to process |
| `PORT` | `3000` | Server listening port |
| `BOT_TAG` | `ai-review-bot` | Identifier for bot comments |

## 🔧 Advanced Configuration

### Customizing Review Criteria

Modify `src/prompt.ts` to adjust review focus:

```typescript
// Add custom rules
Rules:
- Focus on performance implications
- Check for accessibility issues
- Validate error handling patterns
- Review database query efficiency
```

### Extending AI Providers

To support different AI providers, modify `src/gemini.ts`:

```typescript
// Add provider detection
const provider = process.env.AI_PROVIDER ?? 'azure';

switch (provider) {
  case 'azure':
    return await reviewWithAzure(prompt);
  case 'openai':
    return await reviewWithOpenAI(prompt);
  case 'anthropic':
    return await reviewWithAnthropic(prompt);
}
```

### Custom Deduplication Logic

Enhance `src/dedupe.ts` for advanced deduplication:

```typescript
// Add semantic similarity
export function semanticDedupe(findings: ReviewFinding[]): ReviewFinding[] {
  // Implement semantic similarity checking
}
```

## 🚨 Troubleshooting Guide

### Common Issues and Solutions

#### 1. **Webhook Not Triggering**

**Symptoms**: No server activity when PR is created/updated

**Solutions**:
- Verify webhook URL is accessible: `curl https://your-url/webhook/bitbucket`
- Check Bitbucket webhook delivery logs
- Ensure ngrok tunnel is active
- Confirm webhook triggers are enabled

#### 2. **Authentication Errors**

**Symptoms**: 401/403 errors from Bitbucket API

**Solutions**:
- Verify repository access token is valid
- Check token has required permissions
- Ensure token hasn't expired
- Test with fresh token

#### 3. **AI Service Errors**

**Symptoms**: 500 errors, no AI response

**Solutions**:
- Verify Azure OpenAI credentials
- Check deployment name matches
- Ensure API key has proper permissions
- Test with simple prompt

#### 4. **No Comments Posted**

**Symptoms**: Webhook processes but no comments appear

**Solutions**:
- Check `POST_SUMMARY_COMMENT=true`
- Verify server logs for errors
- Test manual API call to Bitbucket
- Check comment permissions

#### 5. **Large PR Processing Issues**

**Symptoms**: Timeout or truncated responses

**Solutions**:
- Reduce `MAX_DIFF_CHARS`
- Enable diff chunking (future enhancement)
- Increase AI timeout
- Monitor memory usage

### Debug Mode

Enable detailed logging:

```typescript
// Add to index.ts
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body);
  next();
});
```

### Manual Testing

Test webhook manually:

```bash
curl -X POST https://your-url/webhook/bitbucket \
  -H "Content-Type: application/json" \
  -H "x-event-key: pullrequest:created" \
  -d '{
    "repository": {
      "workspace": {"slug": "your-workspace"},
      "slug": "your-repo"
    },
    "pullrequest": {"id": 123}
  }'
```

## 🚀 Production Enhancements

For production deployment, consider these improvements:

### 1. **Queue System**
- Use Redis/RabbitMQ for async processing
- Prevent webhook timeouts
- Enable retry mechanisms

### 2. **Database Integration**
- Store review history
- Track processed commits
- Enable comment updates

### 3. **Advanced Diff Processing**
- File-by-file analysis
- Large diff chunking
- Binary file filtering

### 4. **Security Enhancements**
- Rate limiting
- IP whitelisting
- Enhanced webhook verification
- Secret management

### 5. **Monitoring & Observability**
- Structured logging
- Metrics collection
- Health checks
- Error tracking

### 6. **Performance Optimization**
- Response caching
- Connection pooling
- Load balancing
- CDN integration

## 📊 Monitoring and Metrics

### Key Metrics to Track

- **Webhook Processing Time**: Time from webhook to completion
- **AI Response Time**: Time for AI analysis
- **Comment Success Rate**: Percentage of successful comment posts
- **Error Rates**: Types and frequency of errors
- **PR Coverage**: Percentage of PRs reviewed

### Logging Strategy

```typescript
// Structured logging example
logger.info('Review completed', {
  workspace: 'example',
  repo: 'test-repo',
  prId: 123,
  verdict: 'pass',
  findingCount: 2,
  processingTime: 3500
});
```

## 🤝 Contributing

### Development Workflow

1. **Fork and clone** the repository
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes** with tests
4. **Run tests**: `npm test`
5. **Build project**: `npm run build`
6. **Submit pull request**

### Code Style

- Use TypeScript strict mode
- Follow ESLint configuration
- Add JSDoc comments for public functions
- Include unit tests for new features

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:

1. **Check troubleshooting guide** above
2. **Review existing GitHub issues**
3. **Create new issue** with:
   - Environment details
   - Error messages
   - Steps to reproduce
   - Expected vs actual behavior

---

**Happy coding with AI-powered reviews! 🚀**
