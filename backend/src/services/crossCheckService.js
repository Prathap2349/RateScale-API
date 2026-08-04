const axios = require('axios');

const AGREEMENT_TOLERANCE_PCT = 15;
const MODEL_VERSION = 'llama-3.3-70b-versatile';

class CrossCheckService {
  async runCrossCheck({
    recommendationId,
    targetUrl,
    latencyMs,
    p95LatencyMs,
    p99LatencyMs,
    throughputRps,
    errorRatePercent,
    concurrentUsers,
    primaryRps,
    confidenceScore,
  }) {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      console.warn('[CrossCheckService] GROQ_API_KEY is not configured. Skipping secondary AI verification.');
      return {
        verification_status: 'NEEDS_REVIEW',
        secondary_rps: null,
        secondary_reason: 'GROQ_API_KEY environment variable is not configured. Run cross-check manually once configured.',
        secondary_model_version: MODEL_VERSION,
        agreement_percent: null,
        verified_by: null,
        verified_at: null,
      };
    }

    try {
      const systemPrompt = `You are an independent rate-limit reviewer AI. You MUST analyze the telemetry metrics and propose an optimal rate limit in Requests Per Second (RPS) to protect the target URL from overloading while maintaining quality of service.
You MUST output a strict JSON object with no formatting wrapper, no code block, containing exactly:
{
  "recommended_rate_limit_rps": <number>,
  "reason": "<string explanation, max 2 sentences>"
}
Do NOT include any commentary, other text, or HTML. Do NOT wrap in markdown code blocks.`;

      const userPrompt = `Please analyze the following telemetry metrics for target URL '${targetUrl}':
- Average Latency: ${latencyMs} ms
- P95 Latency: ${p95LatencyMs} ms
- P99 Latency: ${p99LatencyMs} ms
- Throughput: ${throughputRps} RPS
- Error Rate: ${errorRatePercent}%
- Concurrent Users: ${concurrentUsers}

Propose an optimal rate-limit recommendation (RPS) and provide a short explanation.`;

      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: MODEL_VERSION,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        }
      );

      let responseText = response.data.choices[0].message.content.trim();
      if (responseText.startsWith('```')) {
        responseText = responseText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(responseText);
      const secondaryRps = Number(parsed.recommended_rate_limit_rps);
      const secondaryReason = parsed.reason;

      if (isNaN(secondaryRps)) {
        throw new Error('Parsed recommended_rate_limit_rps is not a number');
      }

      // Compute % difference & agreement
      // % difference = abs(rps_1 - rps_2) / rps_1 * 100
      let diffPercent = 0;
      if (primaryRps > 0) {
        diffPercent = (Math.abs(primaryRps - secondaryRps) / primaryRps) * 100;
      } else {
        diffPercent = secondaryRps > 0 ? 100 : 0;
      }

      const agreementPercent = Math.max(0, Math.min(100, 100 - diffPercent));
      const modelsAgree = diffPercent <= AGREEMENT_TOLERANCE_PCT;

      let verificationStatus = 'NEEDS_REVIEW';
      let verifiedBy = null;
      let verifiedAt = null;

      if (confidenceScore >= 0.70) {
        if (modelsAgree) {
          verificationStatus = 'AUTO_VERIFIED';
          verifiedBy = 'system';
          verifiedAt = new Date().toISOString();
        } else {
          verificationStatus = 'NEEDS_REVIEW';
        }
      } else {
        verificationStatus = 'NEEDS_REVIEW';
      }

      return {
        verification_status: verificationStatus,
        secondary_rps: secondaryRps,
        secondary_reason: secondaryReason,
        secondary_model_version: MODEL_VERSION,
        agreement_percent: agreementPercent,
        verified_by: verifiedBy,
        verified_at: verifiedAt,
      };

    } catch (err) {
      console.warn('[CrossCheckService] Failed to run Groq cross check:', err.message);
      return {
        verification_status: 'NEEDS_REVIEW',
        secondary_rps: null,
        secondary_reason: `Secondary AI evaluation failed: ${err.message}`,
        secondary_model_version: MODEL_VERSION,
        agreement_percent: null,
        verified_by: null,
        verified_at: null,
      };
    }
  }
}

module.exports = new CrossCheckService();
